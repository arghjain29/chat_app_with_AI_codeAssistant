import { randomBytes } from 'node:crypto';
import {
  canCreateProject,
  PLANS,
  type CreateProjectInput,
  type Project,
  type UpdateProjectInput,
  type UserSummary,
} from '@codecollab/shared';
import type { Types } from 'mongoose';
import { PlanLimitError } from '../../lib/errors.js';
import { deleteProjectMessages, unreadCounts } from '../chat/chat.service.js';
import { deleteAllFiles, seedTemplate } from '../files/file.service.js';
import { UserModel, type UserDoc } from '../users/user.model.js';
import type { ProjectAccess } from './access.js';
import { InviteModel } from './invite.model.js';
import { MembershipModel } from './membership.model.js';
import { ProjectModel, type ProjectDoc } from './project.model.js';
import { toProject, toUserSummary } from './serializers.js';

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

const PREVIEW_SIZE = 4;
const ROLE_RANK = { owner: 0, editor: 1, viewer: 2 } as const;

/** Member count and the first few members (owner first) of each project. */
async function memberSummaries(
  projectIds: Types.ObjectId[],
): Promise<Map<string, { count: number; preview: UserSummary[] }>> {
  const memberships = await MembershipModel.find({ projectId: { $in: projectIds } }).sort({
    createdAt: 1,
  });
  const byProject = new Map<string, typeof memberships>();
  for (const m of memberships) {
    const key = m.projectId.toString();
    byProject.set(key, [...(byProject.get(key) ?? []), m]);
  }
  const previewIds = [...byProject.values()].flatMap((list) =>
    [...list]
      .sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role])
      .slice(0, PREVIEW_SIZE)
      .map((m) => m.userId),
  );
  const users = await UserModel.find({ _id: { $in: previewIds } });
  const userById = new Map(users.map((u) => [u.id as string, u]));

  return new Map(
    [...byProject.entries()].map(([key, list]) => [
      key,
      {
        count: list.length,
        preview: [...list]
          .sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role])
          .slice(0, PREVIEW_SIZE)
          .flatMap((m) => {
            const u = userById.get(m.userId.toString());
            return u ? [toUserSummary(u)] : [];
          }),
      },
    ]),
  );
}

/** Serialize one project for a given caller role. */
export async function presentProject(access: ProjectAccess): Promise<Project> {
  const { project, membership } = access;
  const [owner, members, unread] = await Promise.all([
    UserModel.findById(project.ownerId),
    memberSummaries([project._id]),
    unreadCounts(membership.userId, [project._id]),
  ]);
  const summary = members.get(project.id);
  return toProject(
    project,
    owner,
    membership.role,
    summary?.count ?? 0,
    unread.get(project.id) ?? 0,
    summary?.preview,
  );
}

export async function listProjectsForUser(userId: Types.ObjectId): Promise<Project[]> {
  const memberships = await MembershipModel.find({ userId });
  const roleByProject = new Map(memberships.map((m) => [m.projectId.toString(), m.role]));

  const projects = await ProjectModel.find({ _id: { $in: [...roleByProject.keys()] } }).sort({
    updatedAt: -1,
  });
  const [owners, counts, unread] = await Promise.all([
    UserModel.find({ _id: { $in: projects.map((p) => p.ownerId) } }),
    memberSummaries(projects.map((p) => p._id)),
    unreadCounts(
      userId,
      projects.map((p) => p._id),
    ),
  ]);
  const ownerById = new Map(owners.map((o) => [o.id as string, o]));

  return projects.map((p) =>
    toProject(
      p,
      ownerById.get(p.ownerId.toString()) ?? null,
      roleByProject.get(p.id)!,
      counts.get(p.id)?.count ?? 0,
      unread.get(p.id) ?? 0,
      counts.get(p.id)?.preview,
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
  return toProject(project, user, 'owner', 1, 0, [toUserSummary(user)]);
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
  // Later phases add AI usage here.
  await Promise.all([
    deleteProjectMessages(project._id),
    MembershipModel.deleteMany({ projectId: project._id }),
    InviteModel.deleteMany({ projectId: project._id }),
    deleteAllFiles(project._id),
  ]);
  await project.deleteOne();
}
