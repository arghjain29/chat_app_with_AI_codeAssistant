export const ROLES = ['viewer', 'editor', 'owner'] as const;
export type Role = (typeof ROLES)[number];

const RANK: Record<Role, number> = { viewer: 0, editor: 1, owner: 2 };

/** True when `role` grants at least the permissions of `required`. */
export const hasRole = (role: Role, required: Role): boolean => RANK[role] >= RANK[required];
