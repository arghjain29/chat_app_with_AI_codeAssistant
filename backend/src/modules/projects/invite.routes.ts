import { InviteTokenSchema } from '@codecollab/shared';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { NotFoundError } from '../../lib/errors.js';
import { currentUser, requireUser } from '../../middleware/auth.js';
import { acceptInvite, previewInvite } from './invite.service.js';

export const inviteRouter = Router();
inviteRouter.use(requireUser);

// Tokens are unguessable, but cap lookups anyway so links can't be brute-forced.
inviteRouter.use(
  rateLimit({
    windowMs: 15 * 60_000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // Runs after requireUser, so limit per account rather than per shared office IP.
    keyGenerator: (req) => currentUser(req).id,
    handler: (req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many invite attempts. Wait a few minutes and try again.',
          requestId: String(req.id),
        },
      });
    },
  }),
);

const tokenParam = (raw: string) => {
  const parsed = InviteTokenSchema.safeParse(raw);
  if (!parsed.success) throw new NotFoundError('Invite');
  return parsed.data;
};

inviteRouter.get('/:token', async (req, res) => {
  res.json(await previewInvite(tokenParam(req.params.token), currentUser(req)));
});

inviteRouter.post('/:token/accept', async (req, res) => {
  res.json(await acceptInvite(tokenParam(req.params.token), currentUser(req)));
});
