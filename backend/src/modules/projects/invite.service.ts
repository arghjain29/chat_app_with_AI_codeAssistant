import { createHash, randomBytes } from 'node:crypto';
import {
  ObjectIdSchema,
  PLANS,
  type CreatedInvite,
  type CreateInviteInputSchema,
  type Invite,
  type InvitePreview,
} from '@codecollab/shared';
import type { Types } from 'mongoose';
import type { z } from 'zod';
import { GoneError, NotFoundError, PlanLimitError } from '../../lib/errors.js';
import { UserModel, type UserDoc } from '../users/user.model.js';
import type { ProjectAccess } from './access.js';
import { InviteModel, type InviteDoc } from './invite.model.js';
import { MembershipModel } from './membership.model.js';
import { ProjectModel } from './project.model.js';
import { toInvite, toUserSummary, deletedUser } from './serializers.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Query filter for invites that can still be used right now. */
const usableFilter = () => ({
  revokedAt: null,
  expiresAt: { $gt: new Date() },
  $or: [{ maxUses: null }, { $expr: { $lt: ['$uses', '$maxUses'] } }],
});

export async function createInvite(
  access: ProjectAccess,
  input: z.output<typeof CreateInviteInputSchema>,
  creator: UserDoc,
): Promise<CreatedInvite> {
  const token = randomBytes(24).toString('base64url');
  const invite = await InviteModel.create({
    projectId: access.project._id,
    tokenHash: hashToken(token),
    role: input.role,
    expiresAt: new Date(Date.now() + input.expiresInDays * DAY_MS),
    maxUses: input.maxUses,
    createdBy: creator._id,
  });
  return { ...toInvite(invite, creator), token };
}

export async function listActiveInvites(projectId: Types.ObjectId): Promise<Invite[]> {
  const invites = await InviteModel.find({ projectId, ...usableFilter() }).sort({ createdAt: -1 });
  const creators = await UserModel.find({ _id: { $in: invites.map((i) => i.createdBy) } });
  const byId = new Map(creators.map((c) => [c.id as string, c]));
  return invites.map((i) => toInvite(i, byId.get(String(i.createdBy)) ?? null));
}

export async function revokeInvite(projectId: Types.ObjectId, inviteId: string): Promise<void> {
  if (!ObjectIdSchema.safeParse(inviteId).success) throw new NotFoundError('Invite');
  const res = await InviteModel.updateOne(
    { _id: inviteId, projectId, revokedAt: null },
    { revokedAt: new Date() },
  );
  if (res.matchedCount === 0) throw new NotFoundError('Invite');
}

/** Look up an invite by its raw token and explain precisely why it can't be used. */
async function findUsableInvite(token: string): Promise<InviteDoc> {
  const invite = await InviteModel.findOne({ tokenHash: hashToken(token) });
  if (!invite) throw new NotFoundError('Invite');
  if (invite.revokedAt)
    throw new GoneError('This invite link was turned off by the project owner.');
  if (invite.expiresAt <= new Date()) {
    throw new GoneError('This invite link has expired. Ask the owner for a new one.');
  }
  if (invite.maxUses !== null && invite.maxUses !== undefined && invite.uses >= invite.maxUses) {
    throw new GoneError('This invite link has already been used. Ask the owner for a new one.');
  }
  return invite;
}

async function loadInviteContext(invite: InviteDoc) {
  const project = await ProjectModel.findById(invite.projectId);
  if (!project) throw new NotFoundError('Invite');
  const [owner, memberCount] = await Promise.all([
    UserModel.findById(project.ownerId),
    MembershipModel.countDocuments({ projectId: project._id }),
  ]);
  return { project, owner, memberCount };
}

export async function previewInvite(token: string, user: UserDoc): Promise<InvitePreview> {
  const invite = await findUsableInvite(token);
  const { project, owner, memberCount } = await loadInviteContext(invite);
  const alreadyMember = !!(await MembershipModel.exists({
    projectId: project._id,
    userId: user._id,
  }));
  return {
    projectId: project.id,
    projectName: project.name,
    owner: owner ? toUserSummary(owner) : deletedUser(project.ownerId),
    role: invite.role,
    memberCount,
    alreadyMember,
  };
}

/** Join the project behind an invite. Idempotent for existing members. */
export async function acceptInvite(token: string, user: UserDoc): Promise<{ projectId: string }> {
  const invite = await findUsableInvite(token);
  const { project, owner, memberCount } = await loadInviteContext(invite);

  if (await MembershipModel.exists({ projectId: project._id, userId: user._id })) {
    return { projectId: project.id };
  }

  // The owner's plan decides how many people the project can hold.
  const ownerPlan = owner?.plan ?? 'free';
  const maxMembers = PLANS[ownerPlan].limits.maxMembersPerProject;
  if (memberCount >= maxMembers) {
    throw new PlanLimitError(
      `This project is full (${maxMembers} people on the ${PLANS[ownerPlan].name} plan). The owner can upgrade to Pro to add more people.`,
      { limit: 'maxMembersPerProject', plan: ownerPlan },
    );
  }

  // Claim a use atomically so a limited link can't be used more times than allowed.
  const claimed = await InviteModel.findOneAndUpdate(
    { _id: invite._id, ...usableFilter() },
    { $inc: { uses: 1 } },
  );
  if (!claimed)
    throw new GoneError('This invite link has already been used. Ask the owner for a new one.');

  try {
    await MembershipModel.create({ projectId: project._id, userId: user._id, role: invite.role });
  } catch (err) {
    // Joined concurrently through another request: they're a member, which is what they wanted.
    if ((err as { code?: number }).code !== 11000) throw err;
  }
  await ProjectModel.updateOne({ _id: project._id }, { $currentDate: { updatedAt: true } });
  return { projectId: project.id };
}
