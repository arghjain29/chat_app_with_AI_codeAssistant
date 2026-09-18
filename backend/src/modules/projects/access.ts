import { hasRole, ObjectIdSchema, type Role } from '@codecollab/shared';
import type { Types } from 'mongoose';
import { ForbiddenError, NotFoundError } from '../../lib/errors.js';
import { MembershipModel, type MembershipDoc } from './membership.model.js';
import { ProjectModel, type ProjectDoc } from './project.model.js';

export interface ProjectAccess {
  project: ProjectDoc;
  membership: MembershipDoc;
}

/**
 * Load a project the user belongs to and check their role.
 *
 * Non-members get 404, not 403, so project ids can't be probed for existence.
 * Members without enough rights get 403 with a message they can act on.
 */
export async function requireProjectAccess(
  projectId: string,
  userId: Types.ObjectId,
  minRole: Role = 'viewer',
): Promise<ProjectAccess> {
  if (!ObjectIdSchema.safeParse(projectId).success) throw new NotFoundError('Project');

  const membership = await MembershipModel.findOne({ projectId, userId });
  if (!membership) throw new NotFoundError('Project');

  const project = await ProjectModel.findById(projectId);
  if (!project) throw new NotFoundError('Project');

  if (!hasRole(membership.role, minRole)) {
    throw new ForbiddenError(
      minRole === 'owner'
        ? 'Only the project owner can do this'
        : 'You need editor access to do this. Ask the owner to change your role.',
    );
  }
  return { project, membership };
}
