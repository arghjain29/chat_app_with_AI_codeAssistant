import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

/** Our copy of a user's subscription, kept in sync by payment-provider webhooks. */
const subscriptionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    provider: { type: String, enum: ['stripe'], required: true },
    customerId: { type: String, required: true },
    subscriptionId: { type: String, required: true, unique: true },
    status: { type: String, required: true },
    interval: { type: String, enum: ['month', 'year', null], default: null },
    currentPeriodEnd: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type SubscriptionDoc = HydratedDocument<InferSchemaType<typeof subscriptionSchema>>;
export const SubscriptionModel = model('Subscription', subscriptionSchema);

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
