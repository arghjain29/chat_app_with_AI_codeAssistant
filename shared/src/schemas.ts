import { z } from 'zod';
import { PLAN_IDS } from './plans.js';
import { PROJECT_TEMPLATES } from './files.js';
import { ROLES } from './roles.js';

export const PlanIdSchema = z.enum(PLAN_IDS);
export const RoleSchema = z.enum(ROLES);
/** Roles that can be granted to someone other than the owner. */
export const AssignableRoleSchema = z.enum(['editor', 'viewer']);
export type AssignableRole = z.infer<typeof AssignableRoleSchema>;

export const ObjectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

// ---------- Users ----------

export const MeSchema = z.object({
  id: z.string(),
  email: z.email(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  plan: PlanIdSchema,
  createdAt: z.string(),
});
export type Me = z.infer<typeof MeSchema>;

export const UserSummarySchema = z.object({
  id: z.string(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
});
export type UserSummary = z.infer<typeof UserSummarySchema>;

// ---------- Projects ----------

export const ProjectNameSchema = z
  .string()
  .trim()
  .min(1, 'Give the project a name')
  .max(60, 'Keep the name under 60 characters');

export const ProjectDescriptionSchema = z
  .string()
  .trim()
  .max(280, 'Keep the description under 280 characters');

export const CreateProjectInputSchema = z.object({
  name: ProjectNameSchema,
  description: ProjectDescriptionSchema.optional().default(''),
  /** Files to start with: a small runnable web app, or nothing. */
  template: z.enum(PROJECT_TEMPLATES).optional().default('starter'),
});
export type CreateProjectInput = z.input<typeof CreateProjectInputSchema>;

export const UpdateProjectInputSchema = z
  .object({ name: ProjectNameSchema, description: ProjectDescriptionSchema })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  owner: UserSummarySchema,
  /** The caller's role in this project. */
  role: RoleSchema,
  memberCount: z.number().int(),
  /** Chat messages from others since the caller last read the chat. */
  unreadCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof ProjectSchema>;

// ---------- Members ----------

export const MemberSchema = UserSummarySchema.extend({
  role: RoleSchema,
  joinedAt: z.string(),
});
export type Member = z.infer<typeof MemberSchema>;

export const UpdateMemberInputSchema = z.object({ role: AssignableRoleSchema });
export type UpdateMemberInput = z.infer<typeof UpdateMemberInputSchema>;

// ---------- Invites ----------

export const INVITE_EXPIRY_DAYS = [1, 7, 30] as const;

export const CreateInviteInputSchema = z.object({
  role: AssignableRoleSchema.default('editor'),
  expiresInDays: z.union(INVITE_EXPIRY_DAYS.map((d) => z.literal(d))).default(7),
  /** `null` = unlimited uses until it expires. */
  maxUses: z.number().int().min(1).max(100).nullable().default(null),
});
export type CreateInviteInput = z.input<typeof CreateInviteInputSchema>;

export const InviteSchema = z.object({
  id: z.string(),
  role: AssignableRoleSchema,
  expiresAt: z.string(),
  maxUses: z.number().int().nullable(),
  uses: z.number().int(),
  createdBy: UserSummarySchema.nullable(),
  createdAt: z.string(),
});
export type Invite = z.infer<typeof InviteSchema>;

/** Returned once, when an invite is created. The raw token is never stored. */
export const CreatedInviteSchema = InviteSchema.extend({ token: z.string() });
export type CreatedInvite = z.infer<typeof CreatedInviteSchema>;

export const InvitePreviewSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  owner: UserSummarySchema,
  role: AssignableRoleSchema,
  memberCount: z.number().int(),
  alreadyMember: z.boolean(),
});
export type InvitePreview = z.infer<typeof InvitePreviewSchema>;

export const InviteTokenSchema = z.string().regex(/^[\w-]{20,64}$/, 'Invalid invite link');
