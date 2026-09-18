import type { Invite, Member, Project, Role, UserSummary } from '@codecollab/shared';
import type { Types } from 'mongoose';
import type { InviteDoc } from './invite.model.js';
import type { ProjectDoc } from './project.model.js';

interface UserLike {
  _id: Types.ObjectId;
  username: string;
  avatarUrl?: string | null;
}

export const toUserSummary = (u: UserLike): UserSummary => ({
  id: u._id.toString(),
  username: u.username,
  avatarUrl: u.avatarUrl ?? null,
});

/** A user record that no longer exists (e.g. deleted account). */
export const deletedUser = (id: Types.ObjectId | string): UserSummary => ({
  id: id.toString(),
  username: 'deleted-user',
  avatarUrl: null,
});

export const toProject = (
  p: ProjectDoc,
  owner: UserLike | null,
  role: Role,
  memberCount: number,
  unreadCount = 0,
): Project => ({
  id: p.id,
  name: p.name,
  slug: p.slug,
  description: p.description ?? '',
  owner: owner ? toUserSummary(owner) : deletedUser(p.ownerId),
  role,
  memberCount,
  unreadCount,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});

export const toMember = (user: UserLike, role: Role, joinedAt: Date): Member => ({
  ...toUserSummary(user),
  role,
  joinedAt: joinedAt.toISOString(),
});

export const toInvite = (i: InviteDoc, createdBy: UserLike | null): Invite => ({
  id: i.id,
  role: i.role,
  expiresAt: i.expiresAt.toISOString(),
  maxUses: i.maxUses ?? null,
  uses: i.uses ?? 0,
  createdBy: createdBy ? toUserSummary(createdBy) : null,
  createdAt: i.createdAt.toISOString(),
});
