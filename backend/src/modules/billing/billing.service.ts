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
 * Nothing is granted here: Pro is extended when the paid webhook arrives.
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

/**
 * Extend Pro for a paid payment page. This is the only place a plan becomes Pro, and each
 * payment counts once however often Razorpay reports it.
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
  const record = pass ?? (await ProPassModel.findOne({ userId: user._id }));
  if (record?.lastPaymentId === payment.paymentId) return; // Already applied.

  const interval =
    payment.interval ?? (record?.pendingInterval as BillingInterval | null) ?? 'month';
  const now = new Date();
  // A renewal bought early adds to what's left instead of throwing it away.
  const base = user.proUntil && user.proUntil > now ? user.proUntil : now;
  const proUntil = addInterval(base, interval);

  user.plan = 'pro';
  user.proUntil = proUntil;
  await user.save();

  const clearPending = !record?.pendingLinkId || record.pendingLinkId === payment.linkId;
  await ProPassModel.findOneAndUpdate(
    { userId: user._id },
    {
      provider: 'razorpay',
      proUntil,
      interval,
      lastPaymentId: payment.paymentId,
      ...(clearPending ? { pendingLinkId: null, pendingUrl: null, pendingInterval: null } : {}),
    },
    { upsert: true },
  );
  logger.info({ userId: user.id, interval, proUntil }, 'Pro extended');
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
