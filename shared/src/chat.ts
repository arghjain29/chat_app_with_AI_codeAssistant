import { z } from 'zod';
import { UserSummarySchema } from './schemas.js';

export const CHAT_LIMITS = {
  maxMessageLength: 4000,
  pageSize: 40,
  maxThreadReplies: 500,
} as const;

/** Reactions are limited to a small set, so they stay meaningful and can't be abused. */
export const REACTIONS = ['👍', '❤️', '😂', '🎉', '👀', '🚀', '✅', '🙏'] as const;
export type Reaction = (typeof REACTIONS)[number];

export const MessageKindSchema = z.enum(['user', 'ai', 'system']);

export const ChatMessageSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  kind: MessageKindSchema,
  /** Null for AI and system messages, or when the author's account was deleted. */
  author: UserSummarySchema.nullable(),
  content: z.string(),
  /** Set on thread replies: the id of the message that started the thread. */
  parentId: z.string().nullable(),
  replyCount: z.number().int(),
  lastReplyAt: z.string().nullable(),
  mentions: z.array(z.string()),
  reactions: z.array(z.object({ emoji: z.string(), userIds: z.array(z.string()) })),
  editedAt: z.string().nullable(),
  deletedAt: z.string().nullable(),
  createdAt: z.string(),
  /** Echo of the sender's temporary id, so their optimistic copy can be replaced. */
  clientId: z.string().nullable(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

const ContentSchema = z
  .string()
  .trim()
  .min(1, 'Write a message first')
  .max(
    CHAT_LIMITS.maxMessageLength,
    `Keep messages under ${CHAT_LIMITS.maxMessageLength} characters`,
  );

export const SendMessageInputSchema = z.object({
  content: ContentSchema,
  parentId: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .nullable()
    .optional()
    .default(null),
  /** Client-generated id; sending the same one twice creates only one message. */
  clientId: z.string().min(8).max(64),
});
export type SendMessageInput = z.input<typeof SendMessageInputSchema>;

export const EditMessageInputSchema = z.object({ content: ContentSchema });

export const ReactInputSchema = z.object({ emoji: z.enum(REACTIONS) });

export const MessagePageQuerySchema = z.object({
  /** Return messages older than this message id. */
  before: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(CHAT_LIMITS.pageSize),
});

export interface MessagePage {
  /** Oldest first. */
  items: ChatMessage[];
  /** Pass as `before` to load older messages; null when there are none. */
  nextCursor: string | null;
}

/** Usernames mentioned as `@name` in a message (lowercased, without the @). */
export const extractMentionNames = (content: string): string[] => [
  ...new Set(
    [...content.matchAll(/(?:^|[^\w@])@([a-z0-9_-]{2,32})\b/gi)].map((m) => m[1]!.toLowerCase()),
  ),
];
