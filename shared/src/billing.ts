import { z } from 'zod';
import { PlanIdSchema } from './schemas.js';

export const BILLING_INTERVALS = ['month', 'year'] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const CheckoutInputSchema = z.object({
  interval: z.enum(BILLING_INTERVALS).default('month'),
});
export type CheckoutInput = z.input<typeof CheckoutInputSchema>;

/**
 * Pro is a prepaid pass: you pay for a month or a year, and it runs until `proUntil`.
 * Nothing renews by itself, so there's nothing to cancel.
 */
export const BillingSummarySchema = z.object({
  plan: PlanIdSchema,
  /** False when the server has no payment provider configured. */
  enabled: z.boolean(),
  /** True when payments run in test mode (no real money moves). */
  testMode: z.boolean(),
  /** When Pro runs out, or null on Free. */
  proUntil: z.string().nullable(),
  /** The period bought last time. */
  interval: z.enum(BILLING_INTERVALS).nullable(),
  /** A payment page that was opened but not paid yet. */
  pending: z.object({ url: z.string(), interval: z.enum(BILLING_INTERVALS) }).nullable(),
});
export type BillingSummary = z.infer<typeof BillingSummarySchema>;

export const RedirectSchema = z.object({ url: z.string().url() });
export type Redirect = z.infer<typeof RedirectSchema>;

/** How long a payment adds to Pro. */
export const INTERVAL_DAYS: Record<BillingInterval, number> = { month: 30, year: 365 };

export const INTERVAL_LABEL: Record<BillingInterval, string> = {
  month: '1 month',
  year: '1 year',
};
