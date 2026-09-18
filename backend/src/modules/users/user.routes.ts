import { Router } from 'express';
import { currentUser, requireUser } from '../../middleware/auth.js';
import { toMe } from './user.service.js';

export const userRouter = Router();

userRouter.get('/me', requireUser, (req, res) => {
  res.json(toMe(currentUser(req)));
});
