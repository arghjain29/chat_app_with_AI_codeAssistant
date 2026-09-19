import { hasRole, PLANS, type Role } from '@codecollab/shared';
import { AppError, ConflictError, ForbiddenError, PlanLimitError } from '../lib/errors.js';
import { redis } from '../lib/redis.js';
import type { UserDoc } from '../modules/users/user.model.js';
import { aiConfigured } from './models.js';
import { claimAiRequest, overDailyBudget, quotaPeriod } from './usage.js';

class AiUnavailableError extends AppError {
  constructor(message: string) {
    super(503, 'AI_UNAVAILABLE', message);
  }
}

class RateLimitedError extends AppError {
  constructor(message: string) {
    super(429, 'RATE_LIMITED', message);
  }
}

// ---- Per-minute rate limit (Redis when available, memory otherwise) ----

const memoryHits = new Map<string, { count: number; expires: number }>();

async function hitsThisMinute(userId: string): Promise<number> {
  const bucket = Math.floor(Date.now() / 60_000);
  const key = `ai:rate:${userId}:${bucket}`;
  if (redis?.status === 'ready') {
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, 70);
    return n;
  }
  const now = Date.now();
  for (const [k, v] of memoryHits) if (v.expires < now) memoryHits.delete(k);
  const entry = memoryHits.get(key) ?? { count: 0, expires: now + 70_000 };
  entry.count++;
  memoryHits.set(key, entry);
  return entry.count;
}

// ---- One answer at a time per person per project ----

const inFlight = new Set<string>();
const flightKey = (userId: string, projectId: string) => `${userId}:${projectId}`;

export const releaseAiSlot = (userId: string, projectId: string) =>
  inFlight.delete(flightKey(userId, projectId));

/**
 * Every check that must pass before the assistant answers. Throws a user-facing error
 * explaining what to do; on success the caller holds one quota unit and the in-flight
 * slot, and must call `releaseAiSlot` when the answer ends.
 */
export async function authorizeAiRequest(user: UserDoc, projectId: string, role: Role) {
  if (!aiConfigured()) {
    throw new AiUnavailableError('The AI assistant isn’t set up on this server yet.');
  }
  if (!hasRole(role, 'editor')) {
    throw new ForbiddenError('Viewers can’t ask the AI. Ask the project owner for editor access.');
  }

  const key = flightKey(user.id as string, projectId);
  if (inFlight.has(key)) {
    throw new ConflictError(
      'The AI is still answering your last question. Wait for it or stop it.',
    );
  }

  const plan = PLANS[user.plan];
  if ((await hitsThisMinute(user.id as string)) > plan.limits.aiRatePerMinute) {
    throw new RateLimitedError(
      `That’s ${plan.limits.aiRatePerMinute} AI questions this minute. Try again in a moment.`,
    );
  }
  if (await overDailyBudget()) {
    throw new AiUnavailableError(
      'The AI assistant has reached today’s usage cap for this app. It’s back tomorrow.',
    );
  }
  if (!(await claimAiRequest(user._id, user.plan))) {
    const { limit, period } = plan.limits.aiRequests;
    const resets = quotaPeriod(user.plan).resetsAt;
    throw new PlanLimitError(
      `You’ve used all ${limit} AI requests this ${period} on the ${plan.name} plan. They reset ${resets.toUTCString().slice(0, 16)}${user.plan === 'free' ? ', or upgrade to Pro for more' : ''}.`,
      { limit: 'aiRequests', plan: user.plan },
    );
  }
  inFlight.add(key);
}
