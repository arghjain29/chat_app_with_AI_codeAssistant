export const PLAN_IDS = ['free', 'pro'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export type ModelTier = 'fast' | 'premium';

export interface PlanLimits {
  /** Max projects a user can own. `null` = unlimited. */
  maxOwnedProjects: number | null;
  /** Max members per project, including the owner. */
  maxMembersPerProject: number;
  /** AI request quota and the window it resets over. */
  aiRequests: { limit: number; period: 'day' | 'month' };
  /** AI requests allowed per minute (burst protection). */
  aiRatePerMinute: number;
  /** Largest prompt context we will send to a model, in tokens. */
  maxContextTokens: number;
  modelTiers: readonly ModelTier[];
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** Display prices in USD. Real prices live in the billing provider. */
  price: { monthly: number; yearly: number };
  limits: PlanLimits;
  features: readonly string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'For side projects and trying things out',
    price: { monthly: 0, yearly: 0 },
    limits: {
      maxOwnedProjects: 3,
      maxMembersPerProject: 3,
      aiRequests: { limit: 30, period: 'day' },
      aiRatePerMinute: 5,
      maxContextTokens: 16_000,
      modelTiers: ['fast'],
    },
    features: [
      '3 projects',
      '2 collaborators per project',
      'Live co-editing and chat',
      '30 AI requests per day',
      'Fast AI models',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'For builders who ship with their team',
    price: { monthly: 10, yearly: 96 },
    limits: {
      maxOwnedProjects: null,
      maxMembersPerProject: 11,
      aiRequests: { limit: 1_500, period: 'month' },
      aiRatePerMinute: 20,
      maxContextTokens: 64_000,
      modelTiers: ['fast', 'premium'],
    },
    features: [
      'Unlimited projects',
      '10 collaborators per project',
      '1,500 AI requests per month',
      'Premium models (Claude, Gemini Pro, GPT)',
      'Larger AI context window',
    ],
  },
};

export const getPlan = (id: PlanId): Plan => PLANS[id];

/** Whether a user on `plan` who owns `ownedCount` projects may create another. */
export const canCreateProject = (plan: PlanId, ownedCount: number): boolean => {
  const max = PLANS[plan].limits.maxOwnedProjects;
  return max === null || ownedCount < max;
};
