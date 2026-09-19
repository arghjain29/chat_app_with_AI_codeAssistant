import { z } from 'zod';
import { PlanIdSchema } from './schemas.js';

export const BILLING_INTERVALS = ['month', 'year'] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

/** Stripe price lookup keys, created by `npm run stripe:setup -w backend`. */
export const PRICE_LOOKUP_KEYS: Record<BillingInterval, string> = {
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

/** Statuses that keep Pro features on. `past_due` is a grace period while payment is retried. */
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
  /** Whether the customer portal (invoices, card, cancel) is available. */
  canManage: z.boolean(),
});
export type BillingSummary = z.infer<typeof BillingSummarySchema>;

export const RedirectSchema = z.object({ url: z.string().url() });
export type Redirect = z.infer<typeof RedirectSchema>;
