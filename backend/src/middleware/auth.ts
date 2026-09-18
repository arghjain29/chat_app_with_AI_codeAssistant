import type { Request, RequestHandler } from 'express';
import { getClerkUserId } from '../lib/clerk.js';
import { UnauthenticatedError } from '../lib/errors.js';
import { findOrCreateUserByClerkId } from '../modules/users/user.service.js';

/** Requires a signed-in user and attaches the local user document as `req.user`. */
export const requireUser: RequestHandler = async (req, _res, next) => {
  const clerkId = getClerkUserId(req);
  if (!clerkId) throw new UnauthenticatedError();
  req.user = await findOrCreateUserByClerkId(clerkId);
  next();
};

/** The authenticated user; only valid on routes behind `requireUser`. */
export const currentUser = (req: Request) => {
  if (!req.user) throw new UnauthenticatedError();
  return req.user;
};
