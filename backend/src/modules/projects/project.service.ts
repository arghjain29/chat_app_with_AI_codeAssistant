import { randomBytes } from 'node:crypto';
import {
  canCreateProject,
  PLANS,
  type CreateProjectInput,
  type Project,
  type UpdateProjectInput,
} from '@codecollab/shared';
import type { Types } from 'mongoose';
import { PlanLimitError } from '../../lib/errors.js';
import { deleteAllFiles, seedTemplate } from '../files/file.service.js';
import { UserModel, type UserDoc } from '../users/user.model.js';
import type { ProjectAccess } from './access.js';
import { InviteModel } from './invite.model.js';
import { MembershipModel } from './membership.model.js';
import { ProjectModel, type ProjectDoc } from './project.model.js';
import { toProject } from './serializers.js';

const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .slice(0, 48) || 'project';

async function uniqueSlug(ownerId: Types.ObjectId, name: string, excludeId?: Types.ObjectId) {
  const base = slugify(name);
  let slug = base;
  while (await ProjectModel.exists({ ownerId, slug, _id: { $ne: excludeId } })) {
    slug = `${base}-${randomBytes(2).toString('hex')}`;
  }
  return slug;
}

async function memberCounts(projectIds: Types.ObjectId[]): Promise<Map<string, number>> {
  const rows = await MembershipModel.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { projectId: { $in: projectIds } } },
    { $group: { _id: '$projectId', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id.toString(), r.count]));
}

/** Serialize one project for a given caller role. */
export async function presentProject(access: ProjectAccess): Promise<Project> {
  const { project, membership } = access;
  const [owner, count] = await Promise.all([
    UserModel.findById(project.ownerId),
    MembershipModel.countDocuments({ projectId: project._id }),
  ]);
  return toProject(project, owner, membership.role, count);
}

export async function listProjectsForUser(userId: Types.ObjectId): Promise<Project[]> {
  const memberships = await MembershipModel.find({ userId });
  const roleByProject = new Map(memberships.map((m) => [m.projectId.toString(), m.role]));

  const projects = await ProjectModel.find({ _id: { $in: [...roleByProject.keys()] } }).sort({
    updatedAt: -1,
  });
  const [owners, counts] = await Promise.all([
    UserModel.find({ _id: { $in: projects.map((p) => p.ownerId) } }),
    memberCounts(projects.map((p) => p._id)),
  ]);
  const ownerById = new Map(owners.map((o) => [o.id as string, o]));

  return projects.map((p) =>
    toProject(
      p,
      ownerById.get(p.ownerId.toString()) ?? null,
      roleByProject.get(p.id)!,
      counts.get(p.id) ?? 0,
    ),
  );
}

export async function createProject(user: UserDoc, input: CreateProjectInput): Promise<Project> {
  const owned = await ProjectModel.countDocuments({ ownerId: user._id });
  if (!canCreateProject(user.plan, owned)) {
    const limit = PLANS[user.plan].limits.maxOwnedProjects;
    throw new PlanLimitError(
      `The ${PLANS[user.plan].name} plan includes ${limit} projects. Upgrade to Pro for unlimited projects, or delete one you no longer need.`,
      { limit: 'maxOwnedProjects', plan: user.plan },
    );
  }

  const project = await ProjectModel.create({
    name: input.name,
    description: input.description ?? '',
    slug: await uniqueSlug(user._id, input.name),
    ownerId: user._id,
  });
  try {
    await MembershipModel.create({ projectId: project._id, userId: user._id, role: 'owner' });
    await seedTemplate(project._id, input.template ?? 'starter');
  } catch (err) {
    await deleteProjectCascade(project);
    throw err;
  }
  return toProject(project, user, 'owner', 1);
}

export async function updateProject(
  access: ProjectAccess,
  input: UpdateProjectInput,
): Promise<Project> {
  const { project } = access;
  if (input.name !== undefined && input.name !== project.name) {
    project.name = input.name;
    project.slug = await uniqueSlug(project.ownerId, input.name, project._id);
  }
  if (input.description !== undefined) project.description = input.description;
  await project.save();
  return presentProject(access);
}

/** Delete a project and everything that hangs off it. */
export async function deleteProjectCascade(project: ProjectDoc): Promise<void> {
  // Later phases add messages and AI usage here.
  await Promise.all([
    MembershipModel.deleteMany({ projectId: project._id }),
    InviteModel.deleteMany({ projectId: project._id }),
    deleteAllFiles(project._id),
  ]);
  await project.deleteOne();
}
