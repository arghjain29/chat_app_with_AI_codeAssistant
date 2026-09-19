import { Router } from 'express';
import { currentUser, requireUser } from '../../middleware/auth.js';
import { getUsage } from '../../ai/usage.js';
import { toMe } from './user.service.js';

export const userRouter = Router();

userRouter.get('/me', requireUser, (req, res) => {
  res.json(toMe(currentUser(req)));
});

/** AI requests used and left in the current quota period. */
userRouter.get('/me/usage', requireUser, async (req, res) => {
  const user = currentUser(req);
  res.json(await getUsage(user._id, user.plan));
});
