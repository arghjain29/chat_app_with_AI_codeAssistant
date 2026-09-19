import type { BillingInterval, SubscriptionStatus } from '@codecollab/shared';

/** A subscription as the app sees it, whatever the payment provider. */
export interface ProviderSubscription {
  id: string;
  customerId: string;
  status: SubscriptionStatus;
  interval: BillingInterval | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  /** Our user id, stored on the subscription when checkout starts. */
  userId: string | null;
}

export type BillingEvent =
  | { id: string; kind: 'subscription'; subscription: ProviderSubscription }
  | { id: string; kind: 'ignored'; type: string };

/**
 * Everything the app needs from a payment provider. Stripe implements it today; a second
 * provider (e.g. Razorpay for INR) would implement the same methods.
 */
export interface BillingProvider {
  name: 'stripe';
  /** True when no real money moves (Stripe test keys). */
  testMode: boolean;
  ensureCustomer(user: { id: string; email: string; customerId: string | null }): Promise<string>;
  createCheckout(input: {
    customerId: string;
    userId: string;
    interval: BillingInterval;
    successUrl: string;
    cancelUrl: string;
  }): Promise<string>;
  createPortal(input: { customerId: string; returnUrl: string }): Promise<string>;
  /** Verify the signature and turn the payload into an event. Throws if the signature is bad. */
  parseWebhook(rawBody: Buffer, signature: string): Promise<BillingEvent>;
  cancelNow(subscriptionId: string): Promise<void>;
}

/** Thrown when a webhook's signature doesn't check out. */
export class InvalidSignatureError extends Error {}
