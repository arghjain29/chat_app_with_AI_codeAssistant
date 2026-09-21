import type { BillingInterval, BillingSummary } from '@codecollab/shared';
import { Types } from 'mongoose';
import { env } from '../../env.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { UserModel, type UserDoc } from '../users/user.model.js';
import { ProcessedWebhookModel, ProPassModel } from './billing.model.js';
import type { BillingProvider, PaymentRecord } from './provider.js';
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

/** Where Razorpay sends people back to after they pay. */
const returnUrl = () => `${env.FRONTEND_URL[0]}/billing/success`;

/** One period of Pro added to `from`, by the calendar (a month is a month, not 30 days). */
export function addInterval(from: Date, interval: BillingInterval): Date {
  const end = new Date(from);
  if (interval === 'year') end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return end;
}

export async function getBillingSummary(user: UserDoc): Promise<BillingSummary> {
  const p = billing();
  const pass = await ProPassModel.findOne({ userId: user._id });
  const active = user.plan === 'pro' && !!user.proUntil;
  return {
    plan: user.plan,
    enabled: !!p,
    testMode: p?.testMode ?? true,
    proUntil: active ? (user.proUntil as Date).toISOString() : null,
    interval: active ? ((pass?.interval as BillingInterval | null) ?? null) : null,
    pending:
      pass?.pendingUrl && pass.pendingInterval
        ? { url: pass.pendingUrl, interval: pass.pendingInterval as BillingInterval }
        : null,
  };
}

/**
 * Start (or reopen) a checkout for one period of Pro, and return Razorpay's payment page.
 * Nothing is granted here: Pro is extended once Razorpay confirms the payment.
 */
export async function startCheckout(user: UserDoc, interval: BillingInterval) {
  const p = requireBilling();
  const pass = await ProPassModel.findOne({ userId: user._id });

  // Reopened checkout for the same period: send them back to the same payment page.
  if (pass?.pendingUrl && pass.pendingInterval === interval) return { url: pass.pendingUrl };
  if (pass?.pendingLinkId) {
    await p.cancelCheckout(pass.pendingLinkId).catch(() => undefined); // Abandoned checkout.
  }

  const { linkId, url } = await p.createCheckout({
    userId: user.id as string,
    email: user.email,
    interval,
    returnUrl: returnUrl(),
  });
  await ProPassModel.findOneAndUpdate(
    { userId: user._id },
    {
      provider: p.name,
      pendingLinkId: linkId,
      pendingUrl: url,
      pendingInterval: interval,
    },
    { upsert: true },
  );
  return { url };
}

const DAY_MS = 24 * 60 * 60 * 1000;

interface Grant {
  /** Razorpay payment id, or `admin:<timestamp>` for time added by hand. */
  paymentId: string;
  source: 'razorpay' | 'admin';
  interval: BillingInterval | null;
  /** Where Pro ends, given where it would otherwise end (or now, if it had run out). */
  extend: (from: Date) => Date;
}

/**
 * Add Pro time to a user, once per grant. The pass update doubles as the claim: it only
 * matches while the grant is unrecorded, so a webhook and a direct check racing on the same
 * payment can't both apply it. Returns false if it was already applied.
 */
async function addProTime(user: UserDoc, grant: Grant, paidLinkId?: string) {
  const now = new Date();
  // Buying early adds to what's left instead of throwing it away.
  const base = user.proUntil && user.proUntil > now ? user.proUntil : now;
  const proUntil = grant.extend(base);

  const pass = await ProPassModel.findOne({ userId: user._id });
  const clearPending =
    paidLinkId !== undefined && (!pass?.pendingLinkId || pass.pendingLinkId === paidLinkId);
  try {
    await ProPassModel.updateOne(
      {
        userId: user._id,
        'grants.paymentId': { $ne: grant.paymentId },
        lastPaymentId: { $ne: grant.paymentId },
      },
      {
        $set: {
          provider: 'razorpay',
          proUntil,
          ...(grant.interval ? { interval: grant.interval } : {}),
          ...(clearPending ? { pendingLinkId: null, pendingUrl: null, pendingInterval: null } : {}),
        },
        $push: {
          grants: {
            paymentId: grant.paymentId,
            source: grant.source,
            interval: grant.interval,
            addedMs: proUntil.getTime() - base.getTime(),
            at: now,
          },
        },
      },
      { upsert: true },
    );
  } catch (err) {
    // No match means the grant is already recorded; the upsert then collides on userId.
    if ((err as { code?: number }).code === 11000) return false;
    throw err;
  }

  user.plan = 'pro';
  user.proUntil = proUntil;
  await user.save();
  logger.info({ userId: user.id, source: grant.source, proUntil }, 'Pro extended');
  return true;
}

/**
 * Extend Pro for a paid payment page. This is how a payment becomes Pro, and each payment
 * counts once however often, and in whatever order, Razorpay reports it.
 */
export async function applyPayment(payment: PaymentRecord) {
  const pass = await ProPassModel.findOne({ pendingLinkId: payment.linkId });
  const userId =
    pass?.userId ??
    (payment.userId && Types.ObjectId.isValid(payment.userId) ? payment.userId : null);
  const user = userId ? await UserModel.findById(userId) : null;
  if (!user) {
    logger.warn({ link: payment.linkId }, 'Payment for an unknown user');
    return;
  }
  const interval = payment.interval ?? (pass?.pendingInterval as BillingInterval | null) ?? 'month';
  await addProTime(
    user,
    {
      paymentId: payment.paymentId,
      source: 'razorpay',
      interval,
      extend: (from) => addInterval(from, interval),
    },
    payment.linkId,
  );
}

/**
 * A payment was refunded in full: take back exactly the time it added. Anything bought
 * separately is kept, and if nothing is left the account is back on Free straight away.
 */
export async function refundPayment(paymentId: string) {
  const pass = await ProPassModel.findOne({ 'grants.paymentId': paymentId });
  const grant = pass?.grants.find((g) => g.paymentId === paymentId);
  if (!pass || !grant) {
    const legacy = await ProPassModel.exists({ lastPaymentId: paymentId });
    logger.warn(
      { payment: paymentId },
      legacy
        ? 'Refund for a payment made before grants were recorded; adjust it with the pro script'
        : 'Refund for a payment that never granted Pro',
    );
    return;
  }

  // Claim the refund, so a repeated webhook can't take the time back twice.
  const claimed = await ProPassModel.updateOne(
    { _id: pass._id, grants: { $elemMatch: { paymentId, refundedAt: null } } },
    { $set: { 'grants.$.refundedAt': new Date() } },
  );
  if (claimed.modifiedCount === 0) return;

  const user = await UserModel.findById(pass.userId);
  if (!user?.proUntil) return; // Already on Free: nothing left to take back.
  const until = new Date(user.proUntil.getTime() - grant.addedMs);
  const stillPro = until > new Date();
  user.plan = stillPro ? 'pro' : 'free';
  user.proUntil = stillPro ? until : null;
  await user.save();
  await ProPassModel.updateOne({ _id: pass._id }, { $set: { proUntil: user.proUntil } });
  logger.info({ userId: user.id, payment: paymentId, proUntil: user.proUntil }, 'Refund applied');
}

/** Add Pro by hand (support, demos, goodwill). Stacks on any time left, like a payment. */
export async function adminGrantPro(user: UserDoc, amount: BillingInterval | { days: number }) {
  const interval = typeof amount === 'string' ? amount : null;
  await addProTime(user, {
    paymentId: `admin:${Date.now()}`,
    source: 'admin',
    interval,
    extend: (from) =>
      typeof amount === 'string'
        ? addInterval(from, amount)
        : new Date(from.getTime() + amount.days * DAY_MS),
  });
  return user;
}

/** End Pro now, whatever was paid. Refund the payment in Razorpay separately if one is owed. */
export async function adminRevokePro(user: UserDoc) {
  user.plan = 'free';
  user.proUntil = null;
  await user.save();
  await ProPassModel.updateOne({ userId: user._id }, { $set: { proUntil: null } });
  logger.info({ userId: user.id }, 'Pro revoked by hand');
  return user;
}

/**
 * Ask Razorpay what happened to an unfinished payment, and apply it. Webhooks are the normal
 * path, but they can be slow, misconfigured, or unable to reach a local server, so the app also
 * checks for itself when someone comes back from paying. The answer comes from Razorpay, never
 * from the browser, so this grants nothing on its own.
 */
export async function checkPendingPayment(user: UserDoc): Promise<BillingSummary> {
  const p = billing();
  const pass = await ProPassModel.findOne({ userId: user._id });

  if (p && pass?.pendingLinkId) {
    const linkId = pass.pendingLinkId;
    try {
      const status = await p.checkoutStatus(linkId);
      if (status.state === 'paid') await applyPayment(status.payment);
      else if (status.state === 'closed') await clearPendingCheckout(linkId);
    } catch (err) {
      logger.error({ err, link: linkId }, 'Could not check a payment with Razorpay');
    }
  }
  // applyPayment works on its own copy of the user, so read the plan back.
  return getBillingSummary((await UserModel.findById(user._id)) ?? user);
}

/** A payment page expired or was cancelled: stop offering it as unfinished. */
export async function clearPendingCheckout(linkId: string) {
  await ProPassModel.findOneAndUpdate(
    { pendingLinkId: linkId },
    { pendingLinkId: null, pendingUrl: null, pendingInterval: null },
  );
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
    if (event.kind === 'paid') await applyPayment(event.payment);
    else if (event.kind === 'link-closed') await clearPendingCheckout(event.linkId);
    else if (event.kind === 'refunded') {
      // Partial refunds are goodwill gestures, not a reason to cut Pro short.
      if (event.full) await refundPayment(event.paymentId);
      else logger.info({ payment: event.paymentId }, 'Partial refund: Pro left unchanged');
    }
  } catch (err) {
    // Let the provider retry: forget that we saw it.
    await ProcessedWebhookModel.deleteOne({ provider: p.name, eventId: event.id });
    throw err;
  }
}

/** Account deletion: close any unpaid payment page and forget the pass. */
export async function closeBillingFor(userId: Types.ObjectId) {
  const pass = await ProPassModel.findOne({ userId });
  if (!pass) return;
  const p = billing();
  if (p && pass.pendingLinkId) {
    await p
      .cancelCheckout(pass.pendingLinkId)
      .catch((err) => logger.error({ err, link: pass.pendingLinkId }, 'Could not cancel payment'));
  }
  await pass.deleteOne();
}
