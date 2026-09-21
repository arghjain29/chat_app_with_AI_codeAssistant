import type { BillingInterval } from '@codecollab/shared';

/** A completed payment, as the app sees it. */
export interface PaymentRecord {
  /** The payment page that was paid. */
  linkId: string;
  /** The payment itself, used to apply each payment only once. */
  paymentId: string;
  /** Our user id, stored on the payment page when checkout starts. */
  userId: string | null;
  interval: BillingInterval | null;
}

/** What the provider says about a payment page when we ask it directly. */
export type CheckoutStatus =
  | { state: 'paid'; payment: PaymentRecord }
  /** Still waiting to be paid. */
  | { state: 'open' }
  /** Cancelled or expired without being paid. */
  | { state: 'closed' };

export type BillingEvent =
  | { id: string; kind: 'paid'; payment: PaymentRecord }
  /** The payment page expired or was cancelled without being paid. */
  | { id: string; kind: 'link-closed'; linkId: string }
  /** Money went back to the customer; `full` when the whole payment was returned. */
  | { id: string; kind: 'refunded'; paymentId: string; full: boolean }
  | { id: string; kind: 'ignored'; type: string };

/**
 * Everything the app needs from a payment provider. Razorpay implements it; another
 * provider would implement the same methods.
 */
export interface BillingProvider {
  name: 'razorpay';
  /** True when no real money moves (test keys). */
  testMode: boolean;
  /** Create a payment page for one period of Pro. */
  createCheckout(input: {
    userId: string;
    email: string;
    interval: BillingInterval;
    returnUrl: string;
  }): Promise<{ linkId: string; url: string }>;
  /** Close a payment page that's no longer needed. */
  cancelCheckout(linkId: string): Promise<void>;
  /** Read a payment page back from the provider, for when a webhook never arrives. */
  checkoutStatus(linkId: string): Promise<CheckoutStatus>;
  /** Verify the signature and turn the payload into an event. Throws if the signature is bad. */
  parseWebhook(rawBody: Buffer, signature: string, eventId: string): Promise<BillingEvent>;
}

/** Thrown when a webhook's signature doesn't check out. */
export class InvalidSignatureError extends Error {}
