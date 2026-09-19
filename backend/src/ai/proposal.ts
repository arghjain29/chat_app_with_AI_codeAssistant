import {
  FilePathSchema,
  ProposeChangesInputSchema,
  type AiChange,
  type AiProposal,
} from '@codecollab/shared';
import type { Types } from 'mongoose';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js';
import { liveFileText, replaceFileText } from '../realtime/collab.js';
import { broadcast } from '../modules/chat/chat.service.js';
import { MessageModel } from '../modules/chat/message.model.js';
import { FileModel } from '../modules/files/file.model.js';
import { createEntry, deleteEntry } from '../modules/files/file.service.js';
import { textFromState } from '../modules/files/yjs.js';
import type { ProjectAccess } from '../modules/projects/access.js';
import { hasRole } from '@codecollab/shared';

async function currentText(projectId: Types.ObjectId, path: string) {
  const file = await FileModel.findOne({ projectId, path }).select('+yjsState');
  if (!file) return null;
  if (file.kind !== 'file') return { file, text: null };
  return { file, text: liveFileText(file.id) ?? textFromState(file.yjsState) };
}

/**
 * Turn the model's propose_changes call into a reviewable proposal. Anything unsafe or
 * nonsensical (bad paths, editing folders, deleting missing files) is dropped, and each
 * edit records the file as the AI saw it so the diff and stale-edit check work later.
 */
export async function buildProposal(
  projectId: Types.ObjectId,
  raw: unknown,
): Promise<{ proposal: AiProposal | null; skipped: string[] }> {
  const parsed = ProposeChangesInputSchema.safeParse(raw);
  if (!parsed.success)
    return { proposal: null, skipped: ['The suggested changes were malformed.'] };

  const skipped: string[] = [];
  const changes: AiChange[] = [];
  const seen = new Set<string>();

  for (const change of parsed.data.changes) {
    const path = FilePathSchema.safeParse(change.path);
    if (!path.success) {
      skipped.push(`${change.path}: not a valid project path`);
      continue;
    }
    if (seen.has(path.data)) continue;
    seen.add(path.data);

    const existing = await currentText(projectId, path.data);
    if (existing && existing.text === null) {
      skipped.push(`${path.data}: is a folder`);
      continue;
    }
    if (change.action === 'delete') {
      if (!existing) skipped.push(`${path.data}: doesn't exist`);
      else changes.push({ path: path.data, action: 'delete', before: existing.text! });
      continue;
    }
    if (change.content === undefined) {
      skipped.push(`${path.data}: no content given`);
      continue;
    }
    changes.push(
      existing
        ? { path: path.data, action: 'update', content: change.content, before: existing.text! }
        : { path: path.data, action: 'create', content: change.content },
    );
  }

  if (changes.length === 0) return { proposal: null, skipped };
  return {
    proposal: {
      summary: parsed.data.summary,
      changes,
      status: 'pending',
      decidedBy: null,
      decidedAt: null,
    },
    skipped,
  };
}

async function findProposalMessage(projectId: Types.ObjectId, messageId: string) {
  const doc = await MessageModel.findOne({ _id: messageId, projectId, kind: 'ai' });
  if (!doc?.ai?.proposal) throw new NotFoundError('Suggestion');
  if (doc.ai.proposal.status !== 'pending') {
    throw new ConflictError(`This suggestion was already ${doc.ai.proposal.status}.`);
  }
  return doc;
}

async function markDecided(
  doc: Awaited<ReturnType<typeof findProposalMessage>>,
  status: 'applied' | 'rejected',
  userId: Types.ObjectId,
) {
  doc.ai = {
    ...doc.ai,
    proposal: { ...doc.ai.proposal, status, decidedBy: userId, decidedAt: new Date() },
  };
  doc.markModified('ai');
  await doc.save();
  return broadcast(doc);
}

/** Apply every change in a pending suggestion, or none if any file changed since. */
export async function applyProposal(access: ProjectAccess, messageId: string) {
  const { project, membership } = access;
  if (!hasRole(membership.role, 'editor')) {
    throw new ForbiddenError('Only editors can accept the AI’s suggestions.');
  }
  const doc = await findProposalMessage(project._id, messageId);
  const proposal = doc.ai.proposal as AiProposal;

  // Refuse to overwrite work done after the AI read the files.
  const stale: string[] = [];
  for (const change of proposal.changes) {
    const now = await currentText(project._id, change.path);
    const expected = change.action === 'create' ? null : (change.before ?? null);
    if ((now?.text ?? null) !== expected) stale.push(change.path);
  }
  if (stale.length) {
    throw new ConflictError(
      `${stale.join(', ')} changed after the AI suggested this. Ask again for a fresh suggestion.`,
    );
  }

  const context = {
    userId: String(membership.userId),
    projectId: String(project._id),
    role: membership.role,
  };
  for (const change of proposal.changes) {
    if (change.action === 'create') {
      await createEntry(
        project._id,
        { path: change.path, kind: 'file', content: change.content ?? '' },
        membership.userId,
      );
    } else {
      const file = await FileModel.findOne({ projectId: project._id, path: change.path });
      if (!file) throw new ValidationError(`${change.path} no longer exists.`);
      if (change.action === 'update') await replaceFileText(file.id, change.content ?? '', context);
      else await deleteEntry(project._id, file.id);
    }
  }
  return markDecided(doc, 'applied', membership.userId);
}

export async function rejectProposal(access: ProjectAccess, messageId: string) {
  if (!hasRole(access.membership.role, 'editor')) {
    throw new ForbiddenError('Only editors can dismiss the AI’s suggestions.');
  }
  const doc = await findProposalMessage(access.project._id, messageId);
  return markDecided(doc, 'rejected', access.membership.userId);
}
