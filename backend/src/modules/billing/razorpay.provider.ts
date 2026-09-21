import {
  BILLING_INTERVALS,
  INTERVAL_LABEL,
  PLANS,
  PRICE_CURRENCY,
  type BillingInterval,
} from '@codecollab/shared';
import Razorpay from 'razorpay';
import {
  InvalidSignatureError,
  type BillingEvent,
  type BillingProvider,
  type PaymentRecord,
} from './provider.js';

/** Payment pages stay open for three days, then expire. */
const LINK_TTL_SECONDS = 3 * 24 * 60 * 60;

const priceInPaise = (interval: BillingInterval) =>
  (interval === 'month' ? PLANS.pro.price.monthly : PLANS.pro.price.yearly) * 100;

const asInterval = (value: unknown): BillingInterval | null =>
  BILLING_INTERVALS.includes(value as BillingInterval) ? (value as BillingInterval) : null;

/** What we care about from a payment page: who it was for, and what they bought. */
const recordFrom = (
  linkId: string,
  paymentId: string,
  notes: Record<string, unknown> | undefined,
): PaymentRecord => ({
  linkId,
  paymentId,
  userId: typeof notes?.userId === 'string' ? notes.userId : null,
  interval: asInterval(notes?.interval),
});

/**
 * Razorpay Payment Links: one payment buys one period of Pro. This needs only the standard
 * payments product, not Subscriptions (which is gated for new accounts).
 */
export function razorpayProvider(
  keyId: string,
  keySecret: string,
  webhookSecret: string | undefined,
): BillingProvider {
  const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });

  return {
    name: 'razorpay',
    testMode: keyId.startsWith('rzp_test_'),

    async createCheckout({ userId, email, interval, returnUrl }) {
      const link = await rzp.paymentLink.create({
        amount: priceInPaise(interval),
        currency: PRICE_CURRENCY,
        description: `CodeCollab Pro, ${INTERVAL_LABEL[interval]}`,
        customer: { email },
        notify: { email: true, sms: false },
        reminder_enable: true,
        expire_by: Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS,
        notes: { userId, interval },
        callback_url: returnUrl,
        callback_method: 'get',
      });
      return { linkId: link.id, url: link.short_url };
    },

    async cancelCheckout(linkId) {
      await rzp.paymentLink.cancel(linkId);
    },

    async checkoutStatus(linkId) {
      const link = await rzp.paymentLink.fetch(linkId);
      if (link.status === 'cancelled' || link.status === 'expired') return { state: 'closed' };
      // `payments` is null until someone pays, and holds one entry per attempt.
      const payments = [link.payments ?? []].flat();
      const captured = payments.find((p) => p.status === 'captured');
      if (link.status !== 'paid' || !captured) return { state: 'open' };
      return {
        state: 'paid',
        payment: recordFrom(linkId, captured.payment_id, link.notes),
      };
    },

    async parseWebhook(rawBody, signature, eventId) {
      const body = rawBody.toString('utf8');
      if (
        !webhookSecret ||
        !signature ||
        !Razorpay.validateWebhookSignature(body, signature, webhookSecret)
      ) {
        throw new InvalidSignatureError('Invalid Razorpay signature');
      }
      const payload = JSON.parse(body) as {
        event: string;
        payload?: {
          payment_link?: { entity?: { id?: string; notes?: Record<string, unknown> } };
          payment?: {
            entity?: {
              id?: string;
              amount?: number;
              amount_refunded?: number;
              refund_status?: 'full' | 'partial' | null;
            };
          };
        };
      };
      const ignored = { id: eventId, kind: 'ignored', type: payload.event } satisfies BillingEvent;

      // Refunds are about a payment, not a payment page, so they carry no link.
      if (payload.event === 'payment.refunded') {
        const payment = payload.payload?.payment?.entity;
        if (!payment?.id) return ignored;
        const full =
          payment.refund_status === 'full' ||
          (!!payment.amount && (payment.amount_refunded ?? 0) >= payment.amount);
        return { id: eventId, kind: 'refunded', paymentId: payment.id, full };
      }

      const link = payload.payload?.payment_link?.entity;
      if (!link?.id) return ignored;

      if (payload.event === 'payment_link.paid') {
        const paymentId = payload.payload?.payment?.entity?.id;
        if (!paymentId) return ignored;
        return {
          id: eventId,
          kind: 'paid',
          payment: recordFrom(link.id, paymentId, link.notes),
        };
      }
      if (payload.event === 'payment_link.expired' || payload.event === 'payment_link.cancelled') {
        return { id: eventId, kind: 'link-closed', linkId: link.id };
      }
      return ignored;
    },
  };
}
