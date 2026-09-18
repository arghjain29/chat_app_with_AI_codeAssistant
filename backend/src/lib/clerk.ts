/**
 * The only module that talks to Clerk. Everything else depends on these
 * functions, which keeps auth swappable and easy to mock in tests.
 */
import { clerkClient, clerkMiddleware, getAuth } from '@clerk/express';
import type { Request, RequestHandler } from 'express';
import { env } from '../env.js';

export const authMiddleware = (): RequestHandler =>
  clerkMiddleware({ publishableKey: env.CLERK_PUBLISHABLE_KEY, secretKey: env.CLERK_SECRET_KEY });

/** Clerk user id of the signed-in caller, or null. */
export const getClerkUserId = (req: Request): string | null => {
  const auth = getAuth(req);
  return auth.isAuthenticated ? auth.userId : null;
};

export interface ClerkProfile {
  clerkId: string;
  email: string;
  username: string | null;
  firstName: string | null;
  avatarUrl: string | null;
}

export async function fetchClerkProfile(clerkId: string): Promise<ClerkProfile> {
  const u = await clerkClient.users.getUser(clerkId);
  const primary =
    u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId) ?? u.emailAddresses[0];
  return {
    clerkId: u.id,
    email: primary?.emailAddress ?? '',
    username: u.username,
    firstName: u.firstName,
    avatarUrl: u.imageUrl || null,
  };
}
