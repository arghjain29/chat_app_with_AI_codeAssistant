import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

/**
 * One grant of Pro: a payment, or time added by hand. Recording exactly how much time each
 * one added lets a refund take back that same amount, and makes every payment count once.
 */
const grantSchema = new Schema(
  {
    /** The Razorpay payment id, or `admin:<timestamp>` for time added by hand. */
    paymentId: { type: String, required: true },
    source: { type: String, enum: ['razorpay', 'admin'], required: true },
    interval: { type: String, enum: ['month', 'year', null], default: null },
    addedMs: { type: Number, required: true },
    at: { type: Date, required: true },
    refundedAt: { type: Date, default: null },
  },
  { _id: false },
);

/**
 * A user's Pro pass: what they paid for, until when, and any payment page still waiting
 * to be paid. Written from verified webhooks, from starting a checkout, and by the admin script.
 */
const proPassSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    provider: { type: String, enum: ['razorpay'], required: true },
    /** When Pro runs out. Null before the first payment. */
    proUntil: { type: Date, default: null },
    /** The period bought last time. */
    interval: { type: String, enum: ['month', 'year', null], default: null },
    /** Every grant, oldest first. */
    grants: { type: [grantSchema], default: [] },
    /** Before `grants` existed only the latest payment was kept; still honoured for old passes. */
    lastPaymentId: { type: String, default: null },
    /** A payment page that was opened but not paid yet. */
    pendingLinkId: { type: String, default: null },
    pendingUrl: { type: String, default: null },
    pendingInterval: { type: String, enum: ['month', 'year', null], default: null },
  },
  { timestamps: true },
);
proPassSchema.index({ pendingLinkId: 1 });
proPassSchema.index({ 'grants.paymentId': 1 });

export type ProPassDoc = HydratedDocument<InferSchemaType<typeof proPassSchema>>;
export const ProPassModel = model('ProPass', proPassSchema);

/** Webhook events already handled, so a retried delivery is a no-op. */
const processedWebhookSchema = new Schema(
  {
    provider: { type: String, required: true },
    eventId: { type: String, required: true },
  },
  { timestamps: true },
);
processedWebhookSchema.index({ provider: 1, eventId: 1 }, { unique: true });
// Providers stop retrying after a few days; keep a month to be safe.
processedWebhookSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

export const ProcessedWebhookModel = model('ProcessedWebhook', processedWebhookSchema);
