import { FILE_LIMITS } from '@codecollab/shared';
import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

/**
 * A file or folder in a project. Folders are explicit so empty ones can exist.
 * File contents live in `yjsState` (the Yjs document update), which is what lets
 * several people edit the same file at once without conflicts.
 */
const fileSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    path: { type: String, required: true, maxlength: FILE_LIMITS.maxPathLength },
    kind: { type: String, enum: ['file', 'folder'], required: true },
    /** Encoded Yjs state. Excluded from queries unless asked for: it can be large. */
    yjsState: { type: Buffer, select: false, default: null },
    /** Size of the text in bytes, for display and limits. */
    size: { type: Number, default: 0 },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

fileSchema.index({ projectId: 1, path: 1 }, { unique: true });

export type FileEntryDoc = HydratedDocument<InferSchemaType<typeof fileSchema>>;
export const FileModel = model('File', fileSchema);
