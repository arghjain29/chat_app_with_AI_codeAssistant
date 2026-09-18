import { randomBytes } from 'node:crypto';
import type { Me } from '@codecollab/shared';
import { fetchClerkProfile, type ClerkProfile } from '../../lib/clerk.js';
import { logger } from '../../lib/logger.js';
import { UserModel, type UserDoc } from './user.model.js';

const USERNAME_MAX = 24;

const slugify = (raw: string) =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '')
    .slice(0, USERNAME_MAX - 5) || 'user';

/** Pick a free username based on the Clerk profile, adding a suffix on collision. */
async function uniqueUsername(profile: ClerkProfile, excludeId?: unknown): Promise<string> {
  const base = slugify(profile.username ?? profile.firstName ?? profile.email.split('@')[0] ?? '');
  let candidate = base;
  for (let i = 0; i < 5; i++) {
    const taken = await UserModel.exists({ username: candidate, _id: { $ne: excludeId } });
    if (!taken) return candidate;
    candidate = `${base}-${randomBytes(2).toString('hex')}`;
  }
  return `${base}-${randomBytes(4).toString('hex')}`;
}

/** Create or update the local user from a Clerk profile (webhooks and lazy sign-in). */
export async function upsertUserFromProfile(profile: ClerkProfile): Promise<UserDoc> {
  const existing = await UserModel.findOne({ clerkId: profile.clerkId });
  if (existing) {
    existing.email = profile.email;
    existing.avatarUrl = profile.avatarUrl;
    if (profile.username && profile.username !== existing.username) {
      existing.username = await uniqueUsername(profile, existing._id);
    }
    return existing.save();
  }
  try {
    return await UserModel.create({
      clerkId: profile.clerkId,
      email: profile.email,
      username: await uniqueUsername(profile),
      avatarUrl: profile.avatarUrl,
    });
  } catch (err) {
    // A concurrent request (or the webhook) created the user first.
    if ((err as { code?: number }).code === 11000) {
      const user = await UserModel.findOne({ clerkId: profile.clerkId });
      if (user) return user;
    }
    throw err;
  }
}

/**
 * Local user for a Clerk id. Creates it on first sight so the app works even
 * before the Clerk webhook is configured (e.g. local development).
 */
export async function findOrCreateUserByClerkId(clerkId: string): Promise<UserDoc> {
  const user = await UserModel.findOne({ clerkId });
  if (user) return user;
  logger.info({ clerkId }, 'Creating local user on first request');
  return upsertUserFromProfile(await fetchClerkProfile(clerkId));
}

export async function deleteUserByClerkId(clerkId: string): Promise<void> {
  // Later phases cascade to memberships, owned projects and subscriptions here.
  await UserModel.deleteOne({ clerkId });
}

export const toMe = (user: UserDoc): Me => ({
  id: user.id,
  email: user.email,
  username: user.username,
  avatarUrl: user.avatarUrl ?? null,
  plan: user.plan,
  createdAt: user.createdAt.toISOString(),
});
