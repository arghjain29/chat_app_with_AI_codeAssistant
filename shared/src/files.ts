import { z } from 'zod';
import type { ChatMessage } from './chat.js';

export const FILE_LIMITS = {
  maxEntriesPerProject: 500,
  /** Largest file we accept on create; also the WebSocket message cap. */
  maxFileBytes: 512 * 1024,
  maxPathLength: 300,
  maxDepth: 20,
} as const;

const SEGMENT = /^[\w.@+\- ]+$/;

/**
 * A project-relative path like `src/app.ts`. No leading slash, no `.`/`..` segments,
 * no backslashes, so a path can never point outside the project.
 */
export const FilePathSchema = z
  .string()
  .trim()
  .min(1, 'Enter a name')
  .max(FILE_LIMITS.maxPathLength, 'That path is too long')
  .transform((p) => p.replace(/\/+/g, '/').replace(/\/$/, ''))
  .refine((p) => !p.startsWith('/'), 'Paths are relative to the project, so drop the leading /')
  .refine((p) => p.split('/').length <= FILE_LIMITS.maxDepth, 'Folders are nested too deeply')
  .refine(
    (p) => p.split('/').every((s) => s !== '.' && s !== '..' && SEGMENT.test(s) && s.trim() === s),
    'Use letters, numbers, spaces and . _ - @ + in names',
  );

export const FileKindSchema = z.enum(['file', 'folder']);
export type FileKind = z.infer<typeof FileKindSchema>;

export const FileEntrySchema = z.object({
  id: z.string(),
  path: z.string(),
  kind: FileKindSchema,
  size: z.number().int(),
  updatedAt: z.string(),
});
export type FileEntry = z.infer<typeof FileEntrySchema>;

export const CreateFileInputSchema = z.object({
  path: FilePathSchema,
  kind: FileKindSchema.default('file'),
  content: z
    .string()
    .max(FILE_LIMITS.maxFileBytes, 'That file is too large')
    .optional()
    .default(''),
});
export type CreateFileInput = z.input<typeof CreateFileInputSchema>;

export const MoveFileInputSchema = z.object({ path: FilePathSchema });
export type MoveFileInput = z.infer<typeof MoveFileInputSchema>;

export interface FileSnapshot {
  path: string;
  content: string;
}

export const PROJECT_TEMPLATES = ['starter', 'blank'] as const;
export type ProjectTemplate = (typeof PROJECT_TEMPLATES)[number];

// ---------- Real-time documents ----------

/** Each file is its own Yjs document; each project has one for presence and tree events. */
export const fileDocName = (fileId: string) => `file:${fileId}`;
export const projectDocName = (projectId: string) => `project:${projectId}`;

export const parseDocName = (name: string): { kind: 'file' | 'project'; id: string } | null => {
  const m = /^(file|project):([a-f\d]{24})$/i.exec(name);
  return m ? { kind: m[1] as 'file' | 'project', id: m[2]! } : null;
};

/** The Yjs shared type holding a file's text. */
export const FILE_TEXT_KEY = 'content';

/** Stateless messages the server broadcasts on a project document. */
export type ProjectEvent =
  | { type: 'files-changed' }
  | { type: 'file-deleted'; fileId: string }
  | { type: 'access-changed' }
  /** A chat message was created or changed; clients upsert it by id. */
  | { type: 'message'; message: ChatMessage }
  /** More text streamed into an AI answer. */
  | { type: 'ai-delta'; messageId: string; parentId: string | null; delta: string };

/** What each collaborator publishes through Yjs awareness. */
export interface PresenceState {
  user: { id: string; name: string; color: string; avatarUrl: string | null };
  /** File the person is looking at, if any. */
  fileId?: string | null;
  /** Set while composing a chat message: 'main' or the thread's root message id. */
  typing?: { in: string; at: number } | null;
}
