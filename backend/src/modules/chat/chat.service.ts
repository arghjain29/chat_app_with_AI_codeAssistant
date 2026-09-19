import {
  CHAT_LIMITS,
  extractMentionNames,
  type ChatMessage,
  type MessagePage,
  type Reaction,
} from '@codecollab/shared';
import { Types } from 'mongoose';
import { ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { notifyProject } from '../../realtime/collab.js';
import type { ProjectAccess } from '../projects/access.js';
import { MembershipModel } from '../projects/membership.model.js';
import { deletedUser, toUserSummary } from '../projects/serializers.js';
import { UserModel } from '../users/user.model.js';
import { MessageModel, ReadStateModel, type MessageDoc } from './message.model.js';

/** Serialize messages, looking up their authors in one query. */
async function present(docs: MessageDoc[]): Promise<ChatMessage[]> {
  const ids = [...new Set(docs.flatMap((d) => (d.authorId ? [String(d.authorId)] : [])))];
  const users = await UserModel.find({ _id: { $in: ids } });
  const byId = new Map(users.map((u) => [u.id as string, u]));

  return docs.map((d) => {
    const deleted = !!d.deletedAt;
    const author = d.authorId
      ? (() => {
          const u = byId.get(String(d.authorId));
          return u ? toUserSummary(u) : deletedUser(d.authorId);
        })()
      : null;
    return {
      id: d.id,
      projectId: String(d.projectId),
      kind: d.kind,
      author,
      content: deleted ? '' : d.content,
      parentId: d.parentId ? String(d.parentId) : null,
      replyCount: d.replyCount ?? 0,
      lastReplyAt: d.lastReplyAt?.toISOString() ?? null,
      mentions: deleted ? [] : d.mentions.map(String),
      reactions: deleted
        ? []
        : d.reactions
            .filter((r) => r.userIds.length > 0)
            .map((r) => ({
              emoji: r.emoji,
              userIds: r.userIds.map(String),
            })),
      editedAt: d.editedAt?.toISOString() ?? null,
      deletedAt: d.deletedAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
      clientId: d.clientId ?? null,
      ai: d.ai
        ? {
            status: d.ai.status,
            model: d.ai.model ?? null,
            requestedBy: d.ai.requestedBy ? String(d.ai.requestedBy) : null,
            proposal: d.ai.proposal
              ? {
                  ...d.ai.proposal,
                  decidedBy: d.ai.proposal.decidedBy ? String(d.ai.proposal.decidedBy) : null,
                  decidedAt: d.ai.proposal.decidedAt
                    ? new Date(d.ai.proposal.decidedAt).toISOString()
                    : null,
                }
              : null,
          }
        : null,
    };
  });
}

const presentOne = async (doc: MessageDoc) => (await present([doc]))[0]!;

export const presentMessage = presentOne;

/** Publish a new or changed message to everyone in the project room. */
export async function broadcast(doc: MessageDoc) {
  const message = await presentOne(doc);
  notifyProject(String(doc.projectId), { type: 'message', message });
  return message;
}

/** Resolve @names to members of this project (non-members can't be pinged). */
async function resolveMentions(projectId: Types.ObjectId, content: string) {
  const names = extractMentionNames(content);
  if (names.length === 0) return [];
  const members = await MembershipModel.find({ projectId }, { userId: 1 });
  const users = await UserModel.find(
    { _id: { $in: members.map((m) => m.userId) } },
    { username: 1 },
  );
  return users.filter((u) => names.includes(u.username.toLowerCase())).map((u) => u._id);
}

export async function listMessages(
  projectId: Types.ObjectId,
  opts: { before?: string; limit: number; parentId?: string },
): Promise<MessagePage> {
  const filter: Record<string, unknown> = {
    projectId,
    parentId: opts.parentId ? new Types.ObjectId(opts.parentId) : null,
  };
  if (opts.before) filter._id = { $lt: new Types.ObjectId(opts.before) };

  const docs = await MessageModel.find(filter)
    .sort({ _id: -1 })
    .limit(opts.limit + 1);
  const hasMore = docs.length > opts.limit;
  const page = docs.slice(0, opts.limit).reverse();
  return { items: await present(page), nextCursor: hasMore ? page[0]!.id : null };
}

export async function getThread(projectId: Types.ObjectId, rootId: string) {
  const root = await MessageModel.findOne({ _id: rootId, projectId, parentId: null });
  if (!root) throw new NotFoundError('Message');
  const replies = await MessageModel.find({ projectId, parentId: root._id })
    .sort({ _id: 1 })
    .limit(CHAT_LIMITS.maxThreadReplies);
  const [presentedRoot, ...presentedReplies] = await present([root, ...replies]);
  return { root: presentedRoot!, replies: presentedReplies };
}

export async function sendMessage(
  access: ProjectAccess,
  authorId: Types.ObjectId,
  input: { content: string; parentId: string | null; clientId: string },
): Promise<ChatMessage> {
  const projectId = access.project._id;

  // A retry of a message that already went through: return it unchanged.
  const existing = await MessageModel.findOne({ authorId, clientId: input.clientId });
  if (existing) {
    if (!existing.projectId.equals(projectId)) throw new ValidationError('Duplicate message id');
    return presentOne(existing);
  }

  let root: MessageDoc | null = null;
  if (input.parentId) {
    root = await MessageModel.findOne({ _id: input.parentId, projectId, parentId: null });
    if (!root || root.deletedAt) throw new NotFoundError('Thread');
  }

  let doc: MessageDoc;
  try {
    doc = await MessageModel.create({
      projectId,
      authorId,
      content: input.content,
      parentId: root?._id ?? null,
      mentions: await resolveMentions(projectId, input.content),
      clientId: input.clientId,
    });
  } catch (err) {
    // Two copies of the same send raced; the other one won.
    if ((err as { code?: number }).code === 11000) {
      const winner = await MessageModel.findOne({ authorId, clientId: input.clientId });
      if (winner) return presentOne(winner);
    }
    throw err;
  }

  if (root) {
    const updated = await MessageModel.findByIdAndUpdate(
      root._id,
      { $inc: { replyCount: 1 }, $set: { lastReplyAt: doc.createdAt } },
      { new: true },
    );
    if (updated) await broadcast(updated);
  }
  // Sending counts as reading everything up to now.
  await markRead(projectId, authorId, doc.createdAt);
  return broadcast(doc);
}

async function findOwnMessage(projectId: Types.ObjectId, messageId: string) {
  const doc = await MessageModel.findOne({ _id: messageId, projectId });
  if (!doc || doc.deletedAt) throw new NotFoundError('Message');
  return doc;
}

export async function editMessage(
  projectId: Types.ObjectId,
  messageId: string,
  userId: Types.ObjectId,
  content: string,
) {
  const doc = await findOwnMessage(projectId, messageId);
  if (!doc.authorId?.equals(userId))
    throw new ForbiddenError('You can only edit your own messages');
  doc.content = content;
  doc.mentions = await resolveMentions(projectId, content);
  doc.editedAt = new Date();
  await doc.save();
  return broadcast(doc);
}

/** Authors can delete their own messages; the project owner can delete any message. */
export async function deleteMessage(access: ProjectAccess, messageId: string) {
  const { project, membership } = access;
  const doc = await findOwnMessage(project._id, messageId);
  const isAuthor = doc.authorId?.equals(membership.userId);
  if (!isAuthor && membership.role !== 'owner') {
    throw new ForbiddenError('You can only delete your own messages');
  }
  doc.deletedAt = new Date();
  doc.content = '';
  doc.mentions = [];
  doc.reactions = [] as unknown as typeof doc.reactions;
  await doc.save();
  return broadcast(doc);
}

/** Add the reaction, or remove it if the user already reacted with that emoji. */
export async function toggleReaction(
  projectId: Types.ObjectId,
  messageId: string,
  userId: Types.ObjectId,
  emoji: Reaction,
) {
  const doc = await findOwnMessage(projectId, messageId);
  const existing = doc.reactions.find((r) => r.emoji === emoji);
  if (!existing) {
    doc.reactions.push({ emoji, userIds: [userId] });
  } else if (existing.userIds.some((id) => id.equals(userId))) {
    existing.userIds = existing.userIds.filter((id) => !id.equals(userId));
  } else {
    existing.userIds.push(userId);
  }
  doc.reactions = doc.reactions.filter((r) => r.userIds.length > 0) as typeof doc.reactions;
  await doc.save();
  return broadcast(doc);
}

export async function markRead(projectId: Types.ObjectId, userId: Types.ObjectId, at = new Date()) {
  // Never move the marker backwards (e.g. an old tab reporting late).
  await ReadStateModel.updateOne(
    { userId, projectId },
    { $max: { lastReadAt: at } },
    { upsert: true },
  );
}

/** Unread message counts (from other people) per project, for one user. */
export async function unreadCounts(
  userId: Types.ObjectId,
  projectIds: Types.ObjectId[],
): Promise<Map<string, number>> {
  if (projectIds.length === 0) return new Map();
  const states = await ReadStateModel.find({ userId, projectId: { $in: projectIds } });
  const lastRead = new Map(states.map((s) => [String(s.projectId), s.lastReadAt]));

  const counts = await Promise.all(
    projectIds.map(async (id) => {
      const since = lastRead.get(String(id));
      const n = await MessageModel.countDocuments({
        projectId: id,
        authorId: { $ne: userId },
        deletedAt: null,
        ...(since ? { createdAt: { $gt: since } } : {}),
      });
      return [String(id), n] as const;
    }),
  );
  return new Map(counts);
}

export async function deleteProjectMessages(projectId: Types.ObjectId) {
  await Promise.all([
    MessageModel.deleteMany({ projectId }),
    ReadStateModel.deleteMany({ projectId }),
  ]);
}
