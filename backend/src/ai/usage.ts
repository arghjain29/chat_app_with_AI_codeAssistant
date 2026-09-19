import { PLANS, type PlanId, type Usage } from '@codecollab/shared';
import { Schema, model, type Types } from 'mongoose';
import { env } from '../env.js';
import { aiConfigured } from './models.js';

/** AI requests and spend per user per quota period (a UTC day or month). */
const usageSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  /** "2026-09-19" for daily quotas, "2026-09" for monthly ones. */
  period: { type: String, required: true },
  aiRequests: { type: Number, default: 0 },
  inputTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
  costMicros: { type: Number, default: 0 },
});
usageSchema.index({ userId: 1, period: 1 }, { unique: true });
export const UsageModel = model('Usage', usageSchema);

/** Estimated spend across everyone, per UTC day, for the daily ceiling. */
const spendSchema = new Schema({
  day: { type: String, required: true, unique: true },
  costMicros: { type: Number, default: 0 },
});
export const DailySpendModel = model('DailySpend', spendSchema);

const today = () => new Date().toISOString().slice(0, 10);

export function quotaPeriod(plan: PlanId, now = new Date()) {
  const { period } = PLANS[plan].limits.aiRequests;
  const iso = now.toISOString();
  const key = period === 'day' ? iso.slice(0, 10) : iso.slice(0, 7);
  const resetsAt =
    period === 'day'
      ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { key, period, resetsAt };
}

/**
 * Take one AI request from the user's quota, atomically. Returns false when the quota
 * is used up (nothing is taken in that case).
 */
export async function claimAiRequest(userId: Types.ObjectId, plan: PlanId): Promise<boolean> {
  const { key } = quotaPeriod(plan);
  const limit = PLANS[plan].limits.aiRequests.limit;
  try {
    const doc = await UsageModel.findOneAndUpdate(
      { userId, period: key, aiRequests: { $lt: limit } },
      { $inc: { aiRequests: 1 } },
      { upsert: true, new: true },
    );
    return !!doc;
  } catch (err) {
    // Upsert collided with an existing doc that's at the limit.
    if ((err as { code?: number }).code === 11000) return false;
    throw err;
  }
}

/** Give a request back, e.g. when every provider failed before answering. */
export async function refundAiRequest(userId: Types.ObjectId, plan: PlanId) {
  await UsageModel.updateOne(
    { userId, period: quotaPeriod(plan).key, aiRequests: { $gt: 0 } },
    { $inc: { aiRequests: -1 } },
  );
}

export async function recordSpend(
  userId: Types.ObjectId,
  plan: PlanId,
  usage: { inputTokens: number; outputTokens: number; costMicros: number },
) {
  await Promise.all([
    UsageModel.updateOne(
      { userId, period: quotaPeriod(plan).key },
      {
        $inc: {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          costMicros: usage.costMicros,
        },
      },
      { upsert: true },
    ),
    DailySpendModel.updateOne(
      { day: today() },
      { $inc: { costMicros: usage.costMicros } },
      { upsert: true },
    ),
  ]);
}

export async function overDailyBudget(): Promise<boolean> {
  const doc = await DailySpendModel.findOne({ day: today() });
  return (doc?.costMicros ?? 0) >= env.AI_DAILY_BUDGET_USD * 1_000_000;
}

export async function getUsage(userId: Types.ObjectId, plan: PlanId): Promise<Usage> {
  const { key, period, resetsAt } = quotaPeriod(plan);
  const doc = await UsageModel.findOne({ userId, period: key });
  return {
    plan,
    aiRequests: {
      used: doc?.aiRequests ?? 0,
      limit: PLANS[plan].limits.aiRequests.limit,
      period,
      resetsAt: resetsAt.toISOString(),
    },
    aiAvailable: aiConfigured(),
  };
}
