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
import { stripeProvider } from './stripe.provider.js';

class BillingUnavailableError extends AppError {
  constructor() {
    super(503, 'INTERNAL_ERROR', 'Payments aren’t set up on this server yet.');
  }
}

let provider: BillingProvider | null | undefined;
function billing(): BillingProvider | null {
  if (provider === undefined) {
    provider = env.STRIPE_SECRET_KEY
      ? stripeProvider(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET)
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

const appUrl = (path: string) => `${env.FRONTEND_URL[0]}${path}`;

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
    canManage: !!p && !!user.stripeCustomerId,
  };
}

export async function startCheckout(user: UserDoc, interval: BillingInterval) {
  const p = requireBilling();
  const existing = await SubscriptionModel.findOne({ userId: user._id });
  if (existing && PRO_STATUSES.includes(existing.status as SubscriptionStatus)) {
    throw new ConflictError('You’re already on Pro. Manage your plan from billing settings.');
  }
  const customerId = await p.ensureCustomer({
    id: user.id as string,
    email: user.email,
    customerId: user.stripeCustomerId ?? null,
  });
  if (customerId !== user.stripeCustomerId) {
    user.stripeCustomerId = customerId;
    await user.save();
  }
  const url = await p.createCheckout({
    customerId,
    userId: user.id as string,
    interval,
    successUrl: appUrl('/billing/success'),
    cancelUrl: appUrl('/pricing?checkout=canceled'),
  });
  return { url };
}

export async function openPortal(user: UserDoc) {
  const p = requireBilling();
  if (!user.stripeCustomerId) {
    throw new ConflictError('There’s no billing account yet. Upgrade to Pro first.');
  }
  const url = await p.createPortal({
    customerId: user.stripeCustomerId,
    returnUrl: appUrl('/settings/billing'),
  });
  return { url };
}

/**
 * Store the provider's view of a subscription and set the user's plan from it. This is the
 * only place a plan changes: the checkout success page never grants anything by itself.
 */
export async function syncSubscription(sub: ProviderSubscription) {
  const user =
    (sub.userId && Types.ObjectId.isValid(sub.userId)
      ? await UserModel.findById(sub.userId)
      : null) ?? (await UserModel.findOne({ stripeCustomerId: sub.customerId }));
  if (!user) {
    logger.warn({ subscription: sub.id }, 'Subscription for an unknown user');
    return;
  }

  await SubscriptionModel.findOneAndUpdate(
    { userId: user._id },
    {
      provider: 'stripe',
      customerId: sub.customerId,
      subscriptionId: sub.id,
      status: sub.status,
      interval: sub.interval,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    },
    { upsert: true },
  );

  const plan = PRO_STATUSES.includes(sub.status) ? 'pro' : 'free';
  if (user.plan !== plan || user.stripeCustomerId !== sub.customerId) {
    user.plan = plan;
    user.stripeCustomerId = sub.customerId;
    await user.save();
    logger.info({ userId: user.id, plan, status: sub.status }, 'Plan changed');
  }
}

/**
 * Handle a webhook delivery. Returns false when the signature is invalid. Each event is
 * processed once, however many times the provider retries it.
 */
export async function handleWebhook(rawBody: Buffer, signature: string) {
  const p = requireBilling();
  const event = await p.parseWebhook(rawBody, signature);

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
  if (p && PRO_STATUSES.includes(sub.status as SubscriptionStatus)) {
    await p
      .cancelNow(sub.subscriptionId)
      .catch((err) =>
        logger.error({ err, subscription: sub.subscriptionId }, 'Could not cancel subscription'),
      );
  }
  await sub.deleteOne();
}
