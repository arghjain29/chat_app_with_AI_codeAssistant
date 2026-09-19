import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const reactionSchema = new Schema(
  {
    emoji: { type: String, required: true },
    userIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { _id: false },
);

const messageSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    kind: { type: String, enum: ['user', 'ai', 'system'], default: 'user' },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    // People are limited to CHAT_LIMITS.maxMessageLength by validation; AI answers can be longer.
    content: { type: String, default: '', maxlength: 60_000 },
    /** Thread root this message replies to; null for main-channel messages. */
    parentId: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    replyCount: { type: Number, default: 0 },
    lastReplyAt: { type: Date, default: null },
    mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    reactions: { type: [reactionSchema], default: [] },
    editedAt: { type: Date, default: null },
    /** Soft delete: the message stays (so threads keep their shape) but its content is removed. */
    deletedAt: { type: Date, default: null },
    /** Sender-generated id for idempotent sends. */
    clientId: { type: String, default: null },
    /** AI answers only: { status, model, requestedBy, proposal } (see AiMeta in shared). */
    ai: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

// Main channel / thread pages, newest first by id.
messageSchema.index({ projectId: 1, parentId: 1, _id: -1 });
// Unread counts.
messageSchema.index({ projectId: 1, createdAt: -1 });
// Same client id from the same author = same message.
messageSchema.index(
  { authorId: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } },
);

export type MessageDoc = HydratedDocument<InferSchemaType<typeof messageSchema>>;
export const MessageModel = model('Message', messageSchema);

/** When each person last read a project's chat. */
const readStateSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  lastReadAt: { type: Date, required: true },
});
readStateSchema.index({ userId: 1, projectId: 1 }, { unique: true });

export const ReadStateModel = model('ReadState', readStateSchema);
