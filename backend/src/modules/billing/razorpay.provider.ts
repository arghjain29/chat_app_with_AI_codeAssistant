import { PLAN_REFS, type BillingInterval, type SubscriptionStatus } from '@codecollab/shared';
import Razorpay from 'razorpay';
import type { Subscriptions } from 'razorpay/dist/types/subscriptions';
import { ValidationError } from '../../lib/errors.js';
import {
  InvalidSignatureError,
  type BillingEvent,
  type BillingProvider,
  type ProviderSubscription,
} from './provider.js';

type RzpSubscription = Subscriptions.RazorpaySubscription;

/** Razorpay's subscription statuses, in the app's vocabulary. */
const STATUS: Record<RzpSubscription['status'], SubscriptionStatus> = {
  created: 'incomplete', // Checkout started, not paid yet.
  authenticated: 'incomplete', // Payment method authorised, first charge pending.
  active: 'active',
  pending: 'past_due', // A renewal failed; Razorpay is retrying.
  halted: 'unpaid', // Retries exhausted.
  cancelled: 'canceled',
  completed: 'canceled', // Ran for all its billing cycles.
  expired: 'incomplete_expired', // Checkout never completed.
};

/** Billing cycles to authorise up front: about ten years either way. */
const TOTAL_COUNT: Record<BillingInterval, number> = { month: 120, year: 10 };

export function razorpayProvider(
  keyId: string,
  keySecret: string,
  webhookSecret: string | undefined,
): BillingProvider {
  const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
  const planIds = new Map<BillingInterval, string>();
  const intervalByPlan = new Map<string, BillingInterval>();

  /** Plans are found by the ref in their notes, so no plan IDs live in configuration. */
  async function loadPlans() {
    if (planIds.size) return;
    const { items } = await rzp.plans.all({ count: 100 });
    for (const plan of items) {
      for (const interval of ['month', 'year'] as const) {
        if (plan.notes?.ref === PLAN_REFS[interval] && !planIds.has(interval)) {
          planIds.set(interval, plan.id);
          intervalByPlan.set(plan.id, interval);
        }
      }
    }
  }

  async function planFor(interval: BillingInterval) {
    await loadPlans();
    const id = planIds.get(interval);
    if (!id) {
      throw new ValidationError(
        'Pro plans aren’t set up in Razorpay yet. Run `npm run razorpay:setup -w backend`.',
      );
    }
    return id;
  }

  async function toSubscription(sub: RzpSubscription): Promise<ProviderSubscription> {
    await loadPlans();
    const userId = sub.notes?.userId;
    return {
      id: sub.id,
      status: STATUS[sub.status] ?? 'incomplete',
      interval: intervalByPlan.get(sub.plan_id) ?? null,
      currentPeriodEnd: sub.current_end ? new Date(sub.current_end * 1000) : null,
      userId: typeof userId === 'string' ? userId : null,
    };
  }

  return {
    name: 'razorpay',
    testMode: keyId.startsWith('rzp_test_'),

    async createCheckout({ userId, email, interval }) {
      const sub = await rzp.subscriptions.create({
        plan_id: await planFor(interval),
        total_count: TOTAL_COUNT[interval],
        customer_notify: true,
        notes: { userId, email },
      });
      return { subscriptionId: sub.id, url: sub.short_url };
    },

    async cancelAtPeriodEnd(subscriptionId) {
      await rzp.subscriptions.cancel(subscriptionId, true);
    },

    async cancelNow(subscriptionId) {
      await rzp.subscriptions.cancel(subscriptionId, false);
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
        payload?: { subscription?: { entity?: { id?: string } } };
      };
      const subId = payload.payload?.subscription?.entity?.id;
      if (!payload.event.startsWith('subscription.') || !subId) {
        return { id: eventId, kind: 'ignored', type: payload.event } satisfies BillingEvent;
      }
      // Always read the latest state: webhooks can arrive late or out of order.
      const latest = await rzp.subscriptions.fetch(subId);
      return { id: eventId, kind: 'subscription', subscription: await toSubscription(latest) };
    },
  };
}
