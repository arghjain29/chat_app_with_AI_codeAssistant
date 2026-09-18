import { CreateFileInputSchema, MoveFileInputSchema, ObjectIdSchema } from '@codecollab/shared';
import { Router } from 'express';
import { NotFoundError } from '../../lib/errors.js';
import { currentUser } from '../../middleware/auth.js';
import { parseBody } from '../../middleware/validate.js';
import { requireProjectAccess } from '../projects/access.js';
import { createEntry, deleteEntry, listFiles, moveEntry, snapshotFiles } from './file.service.js';

/** Mounted at /projects/:projectId/files, behind the project router's `requireUser`. */
export const fileRouter = Router({ mergeParams: true });

type Params = { projectId: string; fileId?: string };

const fileIdParam = (raw: string | undefined) => {
  if (!ObjectIdSchema.safeParse(raw).success) throw new NotFoundError('File');
  return raw!;
};

fileRouter.get('/', async (req, res) => {
  const { projectId } = req.params as Params;
  const { project } = await requireProjectAccess(projectId, currentUser(req)._id);
  res.json(await listFiles(project._id));
});

/** Every file's current text, used to run the project in the browser. */
fileRouter.get('/snapshot', async (req, res) => {
  const { projectId } = req.params as Params;
  const { project } = await requireProjectAccess(projectId, currentUser(req)._id);
  res.json(await snapshotFiles(project._id));
});

fileRouter.post('/', async (req, res) => {
  const { projectId } = req.params as Params;
  const user = currentUser(req);
  const { project } = await requireProjectAccess(projectId, user._id, 'editor');
  const input = parseBody(CreateFileInputSchema, req);
  res.status(201).json(await createEntry(project._id, input, user._id));
});

fileRouter.patch('/:fileId', async (req, res) => {
  const { projectId, fileId } = req.params as Params;
  const user = currentUser(req);
  const { project } = await requireProjectAccess(projectId, user._id, 'editor');
  const { path } = parseBody(MoveFileInputSchema, req);
  res.json(await moveEntry(project._id, fileIdParam(fileId), path, user._id));
});

fileRouter.delete('/:fileId', async (req, res) => {
  const { projectId, fileId } = req.params as Params;
  const { project } = await requireProjectAccess(projectId, currentUser(req)._id, 'editor');
  await deleteEntry(project._id, fileIdParam(fileId));
  res.status(204).end();
});
