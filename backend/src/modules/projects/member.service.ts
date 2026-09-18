import { ObjectIdSchema, type AssignableRole, type Member, type Role } from '@codecollab/shared';
import type { Types } from 'mongoose';
import { ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { UserModel } from '../users/user.model.js';
import type { ProjectAccess } from './access.js';
import { MembershipModel } from './membership.model.js';
import { toMember } from './serializers.js';

const ROLE_ORDER: Record<Role, number> = { owner: 0, editor: 1, viewer: 2 };

export async function listMembers(projectId: Types.ObjectId): Promise<Member[]> {
  const memberships = await MembershipModel.find({ projectId });
  const users = await UserModel.find({ _id: { $in: memberships.map((m) => m.userId) } });
  const userById = new Map(users.map((u) => [u.id as string, u]));

  return memberships
    .flatMap((m) => {
      const user = userById.get(m.userId.toString());
      return user ? [toMember(user, m.role, m.createdAt)] : [];
    })
    .sort(
      (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.joinedAt.localeCompare(b.joinedAt),
    );
}

async function findTarget(projectId: Types.ObjectId, targetUserId: string) {
  if (!ObjectIdSchema.safeParse(targetUserId).success) throw new NotFoundError('Member');
  const target = await MembershipModel.findOne({ projectId, userId: targetUserId });
  if (!target) throw new NotFoundError('Member');
  return target;
}

/** Owner changes someone's role. `access` must be an owner-level access check. */
export async function updateMemberRole(
  access: ProjectAccess,
  targetUserId: string,
  role: AssignableRole,
): Promise<Member> {
  const target = await findTarget(access.project._id, targetUserId);
  if (target.role === 'owner') {
    throw new ValidationError('The owner’s role can’t be changed');
  }
  target.role = role;
  await target.save();

  const user = await UserModel.findById(target.userId);
  if (!user) throw new NotFoundError('Member');
  return toMember(user, target.role, target.createdAt);
}

/**
 * Remove a member. Anyone may remove themselves (leave), except the owner.
 * Only the owner may remove other people.
 */
export async function removeMember(access: ProjectAccess, targetUserId: string): Promise<void> {
  const { project, membership: actor } = access;
  const isSelf = actor.userId.toString() === targetUserId;

  if (!isSelf && actor.role !== 'owner') {
    throw new ForbiddenError('Only the project owner can remove people');
  }
  const target = await findTarget(project._id, targetUserId);
  if (target.role === 'owner') {
    throw new ValidationError(
      isSelf
        ? 'Owners can’t leave their own project. Delete the project instead.'
        : 'The owner can’t be removed',
    );
  }
  await target.deleteOne();
}
