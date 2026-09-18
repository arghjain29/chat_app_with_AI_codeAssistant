/**
 * The only module that talks to Clerk. Everything else depends on these
 * functions, which keeps auth swappable and easy to mock in tests.
 */
import { verifyToken } from '@clerk/backend';
import { clerkClient, clerkMiddleware, getAuth } from '@clerk/express';
import type { Request, RequestHandler } from 'express';
import { env } from '../env.js';

/** Tokens minted for other sites (a different `azp`) are rejected. */
const authorizedParties = env.FRONTEND_URL;

export const authMiddleware = (): RequestHandler =>
  clerkMiddleware({
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
    secretKey: env.CLERK_SECRET_KEY,
    authorizedParties,
  });

/** Verify a raw session token (used for WebSocket connections). Returns the Clerk user id. */
export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const claims = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY, authorizedParties });
    return claims.sub ?? null;
  } catch {
    return null;
  }
}

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
