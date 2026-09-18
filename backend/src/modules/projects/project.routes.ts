import {
  CreateInviteInputSchema,
  CreateProjectInputSchema,
  UpdateMemberInputSchema,
  UpdateProjectInputSchema,
} from '@codecollab/shared';
import { Router } from 'express';
import { currentUser, requireUser } from '../../middleware/auth.js';
import { parseBody } from '../../middleware/validate.js';
import { requireProjectAccess } from './access.js';
import { createInvite, listActiveInvites, revokeInvite } from './invite.service.js';
import { listMembers, removeMember, updateMemberRole } from './member.service.js';
import {
  createProject,
  deleteProjectCascade,
  listProjectsForUser,
  presentProject,
  updateProject,
} from './project.service.js';

export const projectRouter = Router();
projectRouter.use(requireUser);

// ---------- Projects ----------

projectRouter.get('/', async (req, res) => {
  res.json(await listProjectsForUser(currentUser(req)._id));
});

projectRouter.post('/', async (req, res) => {
  const input = parseBody(CreateProjectInputSchema, req);
  res.status(201).json(await createProject(currentUser(req), input));
});

projectRouter.get('/:projectId', async (req, res) => {
  const access = await requireProjectAccess(req.params.projectId, currentUser(req)._id);
  res.json(await presentProject(access));
});

projectRouter.patch('/:projectId', async (req, res) => {
  const access = await requireProjectAccess(req.params.projectId, currentUser(req)._id, 'owner');
  res.json(await updateProject(access, parseBody(UpdateProjectInputSchema, req)));
});

projectRouter.delete('/:projectId', async (req, res) => {
  const access = await requireProjectAccess(req.params.projectId, currentUser(req)._id, 'owner');
  await deleteProjectCascade(access.project);
  res.status(204).end();
});

// ---------- Members ----------

projectRouter.get('/:projectId/members', async (req, res) => {
  const { project } = await requireProjectAccess(req.params.projectId, currentUser(req)._id);
  res.json(await listMembers(project._id));
});

projectRouter.patch('/:projectId/members/:userId', async (req, res) => {
  const access = await requireProjectAccess(req.params.projectId, currentUser(req)._id, 'owner');
  const { role } = parseBody(UpdateMemberInputSchema, req);
  res.json(await updateMemberRole(access, req.params.userId, role));
});

projectRouter.delete('/:projectId/members/:userId', async (req, res) => {
  // Any member can reach this (to leave); removeMember enforces owner-only for others.
  const access = await requireProjectAccess(req.params.projectId, currentUser(req)._id);
  await removeMember(access, req.params.userId);
  res.status(204).end();
});

// ---------- Invites (owner only) ----------

projectRouter.get('/:projectId/invites', async (req, res) => {
  const { project } = await requireProjectAccess(
    req.params.projectId,
    currentUser(req)._id,
    'owner',
  );
  res.json(await listActiveInvites(project._id));
});

projectRouter.post('/:projectId/invites', async (req, res) => {
  const user = currentUser(req);
  const access = await requireProjectAccess(req.params.projectId, user._id, 'owner');
  const input = parseBody(CreateInviteInputSchema, req);
  res.status(201).json(await createInvite(access, input, user));
});

projectRouter.delete('/:projectId/invites/:inviteId', async (req, res) => {
  const { project } = await requireProjectAccess(
    req.params.projectId,
    currentUser(req)._id,
    'owner',
  );
  await revokeInvite(project._id, req.params.inviteId);
  res.status(204).end();
});
