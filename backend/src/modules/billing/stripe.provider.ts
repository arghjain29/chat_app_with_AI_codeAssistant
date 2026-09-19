import {
  PRICE_LOOKUP_KEYS,
  type BillingInterval,
  type SubscriptionStatus,
} from '@codecollab/shared';
import Stripe from 'stripe';
import { ValidationError } from '../../lib/errors.js';
import {
  InvalidSignatureError,
  type BillingEvent,
  type BillingProvider,
  type ProviderSubscription,
} from './provider.js';

const SUBSCRIPTION_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
]);

export function stripeProvider(
  secretKey: string,
  webhookSecret: string | undefined,
): BillingProvider {
  const stripe = new Stripe(secretKey);
  const priceIds = new Map<BillingInterval, string>();

  /** Prices are found by lookup key, so no price IDs need to live in configuration. */
  async function priceFor(interval: BillingInterval) {
    const cached = priceIds.get(interval);
    if (cached) return cached;
    const { data } = await stripe.prices.list({
      lookup_keys: [PRICE_LOOKUP_KEYS[interval]],
      active: true,
      limit: 1,
    });
    const id = data[0]?.id;
    if (!id) {
      throw new ValidationError(
        'Pro prices aren’t set up in Stripe yet. Run `npm run stripe:setup -w backend`.',
      );
    }
    priceIds.set(interval, id);
    return id;
  }

  const toSubscription = (sub: Stripe.Subscription): ProviderSubscription => {
    // Since API version 2025-03-31 the billing period lives on each item.
    const item = sub.items.data[0];
    const interval: string | undefined = item?.price.recurring?.interval;
    return {
      id: sub.id,
      customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      status: sub.status as SubscriptionStatus,
      interval: interval === 'month' || interval === 'year' ? interval : null,
      currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      userId: sub.metadata?.userId ?? null,
    };
  };

  /** Always read the latest state: webhooks can arrive late or out of order. */
  const fetchSubscription = async (id: string) =>
    toSubscription(await stripe.subscriptions.retrieve(id));

  return {
    name: 'stripe',
    testMode: secretKey.startsWith('sk_test_') || secretKey.startsWith('rk_test_'),

    async ensureCustomer({ id, email, customerId }) {
      if (customerId) return customerId;
      const customer = await stripe.customers.create({ email, metadata: { userId: id } });
      return customer.id;
    },

    async createCheckout({ customerId, userId, interval, successUrl, cancelUrl }) {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        client_reference_id: userId,
        line_items: [{ price: await priceFor(interval), quantity: 1 }],
        subscription_data: { metadata: { userId } },
        allow_promotion_codes: true,
        success_url: successUrl,
        cancel_url: cancelUrl,
      });
      if (!session.url) throw new Error('Stripe returned no checkout URL');
      return session.url;
    },

    async createPortal({ customerId, returnUrl }) {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });
      return session.url;
    },

    async parseWebhook(rawBody, signature) {
      if (!webhookSecret) throw new InvalidSignatureError('No webhook secret configured');
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
      } catch {
        throw new InvalidSignatureError('Invalid Stripe signature');
      }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const subId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id;
        if (!subId) return { id: event.id, kind: 'ignored', type: event.type };
        return { id: event.id, kind: 'subscription', subscription: await fetchSubscription(subId) };
      }
      if (SUBSCRIPTION_EVENTS.has(event.type)) {
        const sub = event.data.object as Stripe.Subscription;
        return {
          id: event.id,
          kind: 'subscription',
          subscription: await fetchSubscription(sub.id),
        };
      }
      return { id: event.id, kind: 'ignored', type: event.type } satisfies BillingEvent;
    },

    async cancelNow(subscriptionId) {
      await stripe.subscriptions.cancel(subscriptionId);
    },
  };
}
