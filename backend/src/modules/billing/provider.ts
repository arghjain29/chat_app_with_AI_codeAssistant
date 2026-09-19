import type { BillingInterval, SubscriptionStatus } from '@codecollab/shared';

/** A subscription as the app sees it, whatever the payment provider. */
export interface ProviderSubscription {
  id: string;
  status: SubscriptionStatus;
  interval: BillingInterval | null;
  currentPeriodEnd: Date | null;
  /** Our user id, stored on the subscription when checkout starts. */
  userId: string | null;
}

export type BillingEvent =
  | { id: string; kind: 'subscription'; subscription: ProviderSubscription }
  | { id: string; kind: 'ignored'; type: string };

/**
 * Everything the app needs from a payment provider. Razorpay implements it; another
 * provider would implement the same methods.
 */
export interface BillingProvider {
  name: 'razorpay';
  /** True when no real money moves (test keys). */
  testMode: boolean;
  /** Start a subscription and return the hosted page where the customer pays. */
  createCheckout(input: {
    userId: string;
    email: string;
    interval: BillingInterval;
  }): Promise<{ subscriptionId: string; url: string }>;
  /** Stop renewing: Pro stays until the end of the period already paid for. */
  cancelAtPeriodEnd(subscriptionId: string): Promise<void>;
  /** Stop immediately (account deleted, or an abandoned checkout replaced). */
  cancelNow(subscriptionId: string): Promise<void>;
  /** Verify the signature and turn the payload into an event. Throws if the signature is bad. */
  parseWebhook(rawBody: Buffer, signature: string, eventId: string): Promise<BillingEvent>;
}

/** Thrown when a webhook's signature doesn't check out. */
export class InvalidSignatureError extends Error {}
