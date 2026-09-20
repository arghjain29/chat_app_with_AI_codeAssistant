import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

/**
 * A user's Pro pass: what they paid for, until when, and any payment page still waiting
 * to be paid. Written only from verified webhooks and from starting a checkout.
 */
const proPassSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    provider: { type: String, enum: ['razorpay'], required: true },
    /** When Pro runs out. Null before the first payment. */
    proUntil: { type: Date, default: null },
    /** The period bought last time. */
    interval: { type: String, enum: ['month', 'year', null], default: null },
    /** The last payment applied, so a repeated webhook can't extend Pro twice. */
    lastPaymentId: { type: String, default: null },
    /** A payment page that was opened but not paid yet. */
    pendingLinkId: { type: String, default: null },
    pendingUrl: { type: String, default: null },
    pendingInterval: { type: String, enum: ['month', 'year', null], default: null },
  },
  { timestamps: true },
);
proPassSchema.index({ pendingLinkId: 1 });

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
