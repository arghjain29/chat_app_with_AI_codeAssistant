import { z } from 'zod';
import { PlanIdSchema } from './schemas.js';

export const BILLING_INTERVALS = ['month', 'year'] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

/**
 * Tags on the Razorpay plans (in their notes), so the server finds them without storing
 * plan IDs in configuration. Created by `npm run razorpay:setup -w backend`.
 */
export const PLAN_REFS: Record<BillingInterval, string> = {
  month: 'codecollab_pro_monthly',
  year: 'codecollab_pro_yearly',
};

export const CheckoutInputSchema = z.object({
  interval: z.enum(BILLING_INTERVALS).default('month'),
});
export type CheckoutInput = z.input<typeof CheckoutInputSchema>;

export const SubscriptionStatusSchema = z.enum([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'paused',
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

/**
 * Statuses that keep Pro features on. `past_due` is a grace period while a failed charge is
 * retried. Razorpay's statuses map onto these (see the Razorpay provider).
 */
export const PRO_STATUSES: readonly SubscriptionStatus[] = ['active', 'trialing', 'past_due'];

export const BillingSummarySchema = z.object({
  plan: PlanIdSchema,
  /** False when the server has no payment provider configured. */
  enabled: z.boolean(),
  /** True when payments run in test mode (no real money moves). */
  testMode: z.boolean(),
  subscription: z
    .object({
      status: SubscriptionStatusSchema,
      interval: z.enum(BILLING_INTERVALS).nullable(),
      currentPeriodEnd: z.string().nullable(),
      cancelAtPeriodEnd: z.boolean(),
    })
    .nullable(),
  /** True when an active subscription can be cancelled (it isn't already ending). */
  canCancel: z.boolean(),
});
export type BillingSummary = z.infer<typeof BillingSummarySchema>;

export const RedirectSchema = z.object({ url: z.string().url() });
export type Redirect = z.infer<typeof RedirectSchema>;
