import express, { Router } from 'express';
import { verifyWebhook, type WebhookEvent } from '@clerk/express/webhooks';
import { env } from '../../env.js';
import { logger } from '../../lib/logger.js';
import type { UserJSON } from '@clerk/backend';
import type { ClerkProfile } from '../../lib/clerk.js';
import { deleteUserByClerkId, upsertUserFromProfile } from '../users/user.service.js';

type ClerkUserData = UserJSON;

const toProfile = (data: UserJSON): ClerkProfile => {
  const primary =
    data.email_addresses.find((e) => e.id === data.primary_email_address_id) ??
    data.email_addresses[0];
  return {
    clerkId: data.id,
    email: primary?.email_address ?? '',
    username: data.username,
    firstName: data.first_name,
    avatarUrl: data.image_url || null,
  };
};

export const clerkWebhookRouter = Router();

// Signature verification needs the exact raw bytes, so this router parses its own body.
clerkWebhookRouter.post('/', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  let evt: WebhookEvent;
  try {
    evt = await verifyWebhook(req, { signingSecret: env.CLERK_WEBHOOK_SIGNING_SECRET });
  } catch (err) {
    logger.warn({ err }, 'Clerk webhook verification failed');
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid signature' } });
    return;
  }

  switch (evt.type) {
    case 'user.created':
    case 'user.updated':
      await upsertUserFromProfile(toProfile(evt.data));
      break;
    case 'user.deleted':
      if (evt.data.id) await deleteUserByClerkId(evt.data.id);
      break;
    default:
      logger.debug({ type: evt.type }, 'Ignoring Clerk webhook event');
  }
  res.json({ received: true });
});
