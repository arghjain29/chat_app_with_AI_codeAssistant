import { z } from 'zod';
import { FILE_LIMITS } from './files.js';

export const AI_LIMITS = {
  /** Most files one AI suggestion may touch. */
  maxChangesPerProposal: 20,
  /** Messages of recent conversation the AI sees. */
  historyMessages: 20,
} as const;

/** `@ai` anywhere in a message (as its own word) asks the assistant to reply. */
export const mentionsAi = (content: string) => /(^|[^\w@])@ai\b/i.test(content);

export const AiChangeSchema = z.object({
  path: z.string(),
  action: z.enum(['create', 'update', 'delete']),
  /** Full new file content for create/update. */
  content: z.string().max(FILE_LIMITS.maxFileBytes).optional(),
  /** The file as the AI saw it (update/delete), used for the diff and to detect stale edits. */
  before: z.string().optional(),
});
export type AiChange = z.infer<typeof AiChangeSchema>;

export const AiProposalSchema = z.object({
  summary: z.string(),
  changes: z.array(AiChangeSchema),
  status: z.enum(['pending', 'applied', 'rejected']),
  decidedBy: z.string().nullable(),
  decidedAt: z.string().nullable(),
});
export type AiProposal = z.infer<typeof AiProposalSchema>;

export const AiMetaSchema = z.object({
  status: z.enum(['streaming', 'done', 'stopped', 'error']),
  /** Human-readable model name, e.g. "Gemini 3.5 Flash-Lite". */
  model: z.string().nullable(),
  /** Who asked (the user whose message triggered this answer). */
  requestedBy: z.string().nullable(),
  proposal: AiProposalSchema.nullable(),
});
export type AiMeta = z.infer<typeof AiMetaSchema>;

export const UsageSchema = z.object({
  plan: z.enum(['free', 'pro']),
  aiRequests: z.object({
    used: z.number().int(),
    limit: z.number().int(),
    period: z.enum(['day', 'month']),
    resetsAt: z.string(),
  }),
  /** False when no AI provider is configured on the server. */
  aiAvailable: z.boolean(),
});
export type Usage = z.infer<typeof UsageSchema>;

/**
 * The one tool the assistant can call. It only *proposes* edits; nothing changes
 * until a person accepts them.
 */
export const PROPOSE_CHANGES_TOOL = {
  name: 'propose_changes',
  description:
    'Propose file changes for the team to review. Use it only when the user asks you to write, change, fix, add or delete code or files. Give the complete new content of every file you create or update. Nothing changes until a person accepts.',
  parameters: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: 'One sentence describing the change, shown above the diff.',
      },
      changes: {
        type: 'array',
        description: 'The files to create, update or delete.',
        items: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Project-relative path, e.g. src/app.js. No leading slash, no "..".',
            },
            action: { type: 'string', enum: ['create', 'update', 'delete'] },
            content: {
              type: 'string',
              description: 'Complete new file content. Required for create and update.',
            },
          },
          required: ['path', 'action'],
        },
      },
    },
    required: ['summary', 'changes'],
  },
} as const;

/** What the model is allowed to send in a propose_changes call. */
export const ProposeChangesInputSchema = z.object({
  summary: z.string().trim().min(1).max(300),
  changes: z
    .array(
      z.object({
        path: z.string(),
        action: z.enum(['create', 'update', 'delete']),
        content: z.string().max(FILE_LIMITS.maxFileBytes).optional(),
      }),
    )
    .min(1)
    .max(AI_LIMITS.maxChangesPerProposal),
});
export type ProposeChangesInput = z.infer<typeof ProposeChangesInputSchema>;
