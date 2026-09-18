import {
  EditMessageInputSchema,
  MessagePageQuerySchema,
  ObjectIdSchema,
  ReactInputSchema,
  SendMessageInputSchema,
} from '@codecollab/shared';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { NotFoundError } from '../../lib/errors.js';
import { currentUser } from '../../middleware/auth.js';
import { parseBody, parseQuery } from '../../middleware/validate.js';
import { requireProjectAccess } from '../projects/access.js';
import {
  deleteMessage,
  editMessage,
  getThread,
  listMessages,
  markRead,
  sendMessage,
  toggleReaction,
} from './chat.service.js';

/** Mounted at /projects/:projectId/messages, behind the project router's `requireUser`. */
export const chatRouter = Router({ mergeParams: true });

type Params = { projectId: string; messageId?: string };

const messageIdParam = (raw: string | undefined) => {
  if (!ObjectIdSchema.safeParse(raw).success) throw new NotFoundError('Message');
  return raw!;
};

/** Per person, not per IP: 10 messages every 10 seconds is plenty for a human. */
const sendLimiter = rateLimit({
  windowMs: 10_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => currentUser(req).id,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'You’re sending messages too quickly. Wait a few seconds.',
        requestId: String(req.id),
      },
    });
  },
});

// Everyone in the project, viewers included, can read and write chat.

chatRouter.get('/', async (req, res) => {
  const { projectId } = req.params as Params;
  const { project } = await requireProjectAccess(projectId, currentUser(req)._id);
  res.json(await listMessages(project._id, parseQuery(MessagePageQuerySchema, req)));
});

chatRouter.get('/:messageId/thread', async (req, res) => {
  const { projectId, messageId } = req.params as Params;
  const { project } = await requireProjectAccess(projectId, currentUser(req)._id);
  res.json(await getThread(project._id, messageIdParam(messageId)));
});

chatRouter.post('/', sendLimiter, async (req, res) => {
  const { projectId } = req.params as Params;
  const user = currentUser(req);
  const access = await requireProjectAccess(projectId, user._id);
  const input = parseBody(SendMessageInputSchema, req);
  res.status(201).json(await sendMessage(access, user._id, input));
});

chatRouter.post('/read', async (req, res) => {
  const { projectId } = req.params as Params;
  const user = currentUser(req);
  const { project } = await requireProjectAccess(projectId, user._id);
  await markRead(project._id, user._id);
  res.status(204).end();
});

chatRouter.patch('/:messageId', async (req, res) => {
  const { projectId, messageId } = req.params as Params;
  const user = currentUser(req);
  const { project } = await requireProjectAccess(projectId, user._id);
  const { content } = parseBody(EditMessageInputSchema, req);
  res.json(await editMessage(project._id, messageIdParam(messageId), user._id, content));
});

chatRouter.delete('/:messageId', async (req, res) => {
  const { projectId, messageId } = req.params as Params;
  const access = await requireProjectAccess(projectId, currentUser(req)._id);
  res.json(await deleteMessage(access, messageIdParam(messageId)));
});

chatRouter.post('/:messageId/reactions', async (req, res) => {
  const { projectId, messageId } = req.params as Params;
  const user = currentUser(req);
  const { project } = await requireProjectAccess(projectId, user._id);
  const { emoji } = parseBody(ReactInputSchema, req);
  res.json(await toggleReaction(project._id, messageIdParam(messageId), user._id, emoji));
});
