import {
  FILE_LIMITS,
  type CreateFileInput,
  type FileEntry,
  type FileSnapshot,
  type ProjectTemplate,
} from '@codecollab/shared';
import type { Types } from 'mongoose';
import { ConflictError, NotFoundError, PlanLimitError, ValidationError } from '../../lib/errors.js';
import { closeFileDocument, liveFileText, notifyProject } from '../../realtime/collab.js';
import { FileModel, type FileEntryDoc } from './file.model.js';
import { TEMPLATES } from './templates.js';
import { stateFromText, textFromState } from './yjs.js';

const toEntry = (f: FileEntryDoc): FileEntry => ({
  id: f.id,
  path: f.path,
  kind: f.kind,
  size: f.size ?? 0,
  updatedAt: f.updatedAt.toISOString(),
});

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const descendantsFilter = (projectId: Types.ObjectId, folder: string) => ({
  projectId,
  path: { $regex: `^${escapeRegex(folder)}/` },
});

/** All ancestor folder paths of `path`, outermost first: a/b/c.ts -> [a, a/b]. */
const ancestorsOf = (path: string) =>
  path
    .split('/')
    .slice(0, -1)
    .map((_, i, parts) => parts.slice(0, i + 1).join('/'));

const isDuplicateKey = (err: unknown) => (err as { code?: number }).code === 11000;

export async function listFiles(projectId: Types.ObjectId): Promise<FileEntry[]> {
  const files = await FileModel.find({ projectId }).sort({ path: 1 });
  return files.map(toEntry);
}

/** Make sure every parent folder of `path` exists, and that none of them is a file. */
async function ensureParents(projectId: Types.ObjectId, path: string, userId?: Types.ObjectId) {
  for (const folder of ancestorsOf(path)) {
    const existing = await FileModel.findOne({ projectId, path: folder });
    if (existing?.kind === 'file') {
      throw new ValidationError(`“${folder}” is a file, so it can’t contain other files`);
    }
    if (!existing) {
      await FileModel.create({ projectId, path: folder, kind: 'folder', updatedBy: userId }).catch(
        (err) => {
          if (!isDuplicateKey(err)) throw err; // Created concurrently: fine.
        },
      );
    }
  }
}

async function assertRoomFor(projectId: Types.ObjectId, adding: number) {
  const count = await FileModel.countDocuments({ projectId });
  if (count + adding > FILE_LIMITS.maxEntriesPerProject) {
    throw new PlanLimitError(
      `Projects can hold up to ${FILE_LIMITS.maxEntriesPerProject} files and folders. Delete some to add more.`,
      { limit: 'maxEntriesPerProject' },
    );
  }
}

export async function createEntry(
  projectId: Types.ObjectId,
  input: Required<CreateFileInput>,
  userId: Types.ObjectId,
): Promise<FileEntry> {
  await assertRoomFor(projectId, input.path.split('/').length);
  if (await FileModel.exists({ projectId, path: input.path })) {
    throw new ConflictError(`“${input.path}” already exists`);
  }
  await ensureParents(projectId, input.path, userId);

  try {
    const entry = await FileModel.create({
      projectId,
      path: input.path,
      kind: input.kind,
      updatedBy: userId,
      ...(input.kind === 'file'
        ? { yjsState: stateFromText(input.content), size: Buffer.byteLength(input.content) }
        : {}),
    });
    notifyProject(String(projectId), { type: 'files-changed' });
    return toEntry(entry);
  } catch (err) {
    if (isDuplicateKey(err)) throw new ConflictError(`“${input.path}” already exists`);
    throw err;
  }
}

/** Rename or move a file or folder (a folder brings its contents along). */
export async function moveEntry(
  projectId: Types.ObjectId,
  fileId: string,
  newPath: string,
  userId: Types.ObjectId,
): Promise<FileEntry> {
  const entry = await FileModel.findOne({ _id: fileId, projectId });
  if (!entry) throw new NotFoundError('File');
  if (entry.path === newPath) return toEntry(entry);

  if (entry.kind === 'folder' && newPath.startsWith(`${entry.path}/`)) {
    throw new ValidationError('A folder can’t be moved inside itself');
  }
  if (await FileModel.exists({ projectId, path: newPath })) {
    throw new ConflictError(`“${newPath}” already exists`);
  }
  await ensureParents(projectId, newPath, userId);

  const oldPath = entry.path;
  if (entry.kind === 'folder') {
    const children = await FileModel.find(descendantsFilter(projectId, oldPath), { path: 1 });
    if (children.length) {
      await FileModel.bulkWrite(
        children.map((c) => ({
          updateOne: {
            filter: { _id: c._id },
            update: { $set: { path: newPath + c.path.slice(oldPath.length) } },
          },
        })),
      );
    }
  }
  entry.path = newPath;
  entry.updatedBy = userId;
  try {
    await entry.save();
  } catch (err) {
    if (isDuplicateKey(err)) throw new ConflictError(`“${newPath}” already exists`);
    throw err;
  }
  notifyProject(String(projectId), { type: 'files-changed' });
  return toEntry(entry);
}

/** Delete a file, or a folder and everything in it. */
export async function deleteEntry(projectId: Types.ObjectId, fileId: string): Promise<void> {
  const entry = await FileModel.findOne({ _id: fileId, projectId });
  if (!entry) throw new NotFoundError('File');

  const doomed =
    entry.kind === 'folder'
      ? [entry, ...(await FileModel.find(descendantsFilter(projectId, entry.path), { kind: 1 }))]
      : [entry];
  await FileModel.deleteMany({ _id: { $in: doomed.map((d) => d._id) } });

  for (const d of doomed) {
    if (d.kind !== 'file') continue;
    closeFileDocument(d.id);
    notifyProject(String(projectId), { type: 'file-deleted', fileId: d.id });
  }
  notifyProject(String(projectId), { type: 'files-changed' });
}

/** Current text of every file, including unsaved edits of files open right now. */
export async function snapshotFiles(projectId: Types.ObjectId): Promise<FileSnapshot[]> {
  const files = await FileModel.find({ projectId, kind: 'file' })
    .select('+yjsState')
    .sort({ path: 1 });
  return files.map((f) => ({
    path: f.path,
    content: liveFileText(f.id) ?? textFromState(f.yjsState),
  }));
}

export async function seedTemplate(projectId: Types.ObjectId, template: ProjectTemplate) {
  const files = TEMPLATES[template];
  if (!files.length) return;
  await FileModel.insertMany(
    files.map((f) => ({
      projectId,
      path: f.path,
      kind: 'file' as const,
      yjsState: stateFromText(f.content),
      size: Buffer.byteLength(f.content),
    })),
  );
}

export async function deleteAllFiles(projectId: Types.ObjectId) {
  const files = await FileModel.find({ projectId, kind: 'file' }, { _id: 1 });
  await FileModel.deleteMany({ projectId });
  for (const f of files) closeFileDocument(f.id);
}
