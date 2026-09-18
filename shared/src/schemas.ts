import { z } from 'zod';
import { PLAN_IDS } from './plans.js';

export const PlanIdSchema = z.enum(PLAN_IDS);

export const MeSchema = z.object({
  id: z.string(),
  email: z.email(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  plan: PlanIdSchema,
  createdAt: z.string(),
});
export type Me = z.infer<typeof MeSchema>;
