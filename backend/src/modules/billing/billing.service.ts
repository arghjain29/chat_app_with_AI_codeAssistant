import {
  PRO_STATUSES,
  type BillingInterval,
  type BillingSummary,
  type SubscriptionStatus,
} from '@codecollab/shared';
import { Types } from 'mongoose';
import { env } from '../../env.js';
import { AppError, ConflictError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { UserModel, type UserDoc } from '../users/user.model.js';
import { ProcessedWebhookModel, SubscriptionModel } from './billing.model.js';
import type { BillingProvider, ProviderSubscription } from './provider.js';
import { razorpayProvider } from './razorpay.provider.js';

class BillingUnavailableError extends AppError {
  constructor() {
    super(503, 'INTERNAL_ERROR', 'Payments aren’t set up on this server yet.');
  }
}

let provider: BillingProvider | null | undefined;
function billing(): BillingProvider | null {
  if (provider === undefined) {
    provider =
      env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET
        ? razorpayProvider(
            env.RAZORPAY_KEY_ID,
            env.RAZORPAY_KEY_SECRET,
            env.RAZORPAY_WEBHOOK_SECRET,
          )
        : null;
  }
  return provider;
}
const requireBilling = () => {
  const p = billing();
  if (!p) throw new BillingUnavailableError();
  return p;
};

/** Tests swap in a fake provider. */
export function setBillingProviderForTesting(fake: BillingProvider | null | undefined) {
  provider = fake;
}

const isPro = (status: string) => PRO_STATUSES.includes(status as SubscriptionStatus);

export async function getBillingSummary(user: UserDoc): Promise<BillingSummary> {
  const p = billing();
  const sub = await SubscriptionModel.findOne({ userId: user._id });
  return {
    plan: user.plan,
    enabled: !!p,
    testMode: p?.testMode ?? true,
    subscription: sub
      ? {
          status: sub.status as SubscriptionStatus,
          interval: (sub.interval as BillingInterval | null) ?? null,
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        }
      : null,
    canCancel: !!p && !!sub && isPro(sub.status) && !sub.cancelAtPeriodEnd,
  };
}

/**
 * Start (or resume) a checkout. Returns Razorpay's hosted payment page. Nothing is granted
 * here: Pro switches on when the webhook reports the subscription active.
 */
export async function startCheckout(user: UserDoc, interval: BillingInterval) {
  const p = requireBilling();
  const existing = await SubscriptionModel.findOne({ userId: user._id });
  if (existing && isPro(existing.status)) {
    throw new ConflictError('You’re already on Pro. Manage your plan from billing settings.');
  }
  // Reopened checkout for the same plan: reuse the payment page instead of a new subscription.
  if (existing?.status === 'incomplete' && existing.interval === interval && existing.checkoutUrl) {
    return { url: existing.checkoutUrl };
  }
  if (existing?.status === 'incomplete') {
    await p.cancelNow(existing.subscriptionId).catch(() => undefined); // Abandoned checkout.
  }

  const { subscriptionId, url } = await p.createCheckout({
    userId: user.id as string,
    email: user.email,
    interval,
  });
  await SubscriptionModel.findOneAndUpdate(
    { userId: user._id },
    {
      provider: p.name,
      subscriptionId,
      status: 'incomplete',
      interval,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      checkoutUrl: url,
    },
    { upsert: true },
  );
  return { url };
}

/** Stop renewing. Pro stays until the end of the paid period, then the webhook ends it. */
export async function cancelSubscription(user: UserDoc) {
  const p = requireBilling();
  const sub = await SubscriptionModel.findOne({ userId: user._id });
  if (!sub || !isPro(sub.status)) throw new ConflictError('You don’t have an active subscription.');
  if (sub.cancelAtPeriodEnd) throw new ConflictError('Your subscription is already set to end.');
  await p.cancelAtPeriodEnd(sub.subscriptionId);
  sub.cancelAtPeriodEnd = true;
  await sub.save();
  return getBillingSummary(user);
}

/**
 * Store the provider's view of a subscription and set the user's plan from it. This is the
 * only place a plan changes.
 */
export async function syncSubscription(sub: ProviderSubscription) {
  const record = await SubscriptionModel.findOne({ subscriptionId: sub.id });
  const userId =
    record?.userId ?? (sub.userId && Types.ObjectId.isValid(sub.userId) ? sub.userId : null);
  const user = userId ? await UserModel.findById(userId) : null;
  if (!user) {
    logger.warn({ subscription: sub.id }, 'Subscription for an unknown user');
    return;
  }

  // An older, replaced checkout reporting in late mustn't overwrite the current subscription.
  const current = await SubscriptionModel.findOne({ userId: user._id });
  if (current && current.subscriptionId !== sub.id && !isPro(sub.status)) return;

  await SubscriptionModel.findOneAndUpdate(
    { userId: user._id },
    {
      provider: 'razorpay',
      subscriptionId: sub.id,
      status: sub.status,
      interval: sub.interval ?? current?.interval ?? null,
      currentPeriodEnd: sub.currentPeriodEnd,
      // Razorpay doesn't report a scheduled cancellation, so keep ours until it takes effect.
      cancelAtPeriodEnd: isPro(sub.status) ? (current?.cancelAtPeriodEnd ?? false) : false,
      ...(sub.status !== 'incomplete' ? { checkoutUrl: null } : {}),
    },
    { upsert: true },
  );

  const plan = isPro(sub.status) ? 'pro' : 'free';
  if (user.plan !== plan) {
    user.plan = plan;
    await user.save();
    logger.info({ userId: user.id, plan, status: sub.status }, 'Plan changed');
  }
}

/** Handle a webhook delivery. Each event is processed once, however often it's retried. */
export async function handleWebhook(rawBody: Buffer, signature: string, eventId: string) {
  const p = requireBilling();
  const event = await p.parseWebhook(rawBody, signature, eventId);

  try {
    await ProcessedWebhookModel.create({ provider: p.name, eventId: event.id });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return; // Already handled.
    throw err;
  }

  try {
    if (event.kind === 'subscription') await syncSubscription(event.subscription);
  } catch (err) {
    // Let the provider retry: forget that we saw it.
    await ProcessedWebhookModel.deleteOne({ provider: p.name, eventId: event.id });
    throw err;
  }
}

/** Account deletion: stop charging immediately. */
export async function cancelSubscriptionsFor(userId: Types.ObjectId) {
  const sub = await SubscriptionModel.findOne({ userId });
  if (!sub) return;
  const p = billing();
  if (p && (isPro(sub.status) || sub.status === 'incomplete')) {
    await p
      .cancelNow(sub.subscriptionId)
      .catch((err) =>
        logger.error({ err, subscription: sub.subscriptionId }, 'Could not cancel subscription'),
      );
  }
  await sub.deleteOne();
}
