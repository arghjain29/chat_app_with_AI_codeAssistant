import { CheckoutInputSchema } from '@codecollab/shared';
import { randomUUID } from 'node:crypto';
import express, { Router } from 'express';
import { logger } from '../../lib/logger.js';
import { currentUser, requireUser } from '../../middleware/auth.js';
import { parseBody } from '../../middleware/validate.js';
import {
  checkPendingPayment,
  getBillingSummary,
  handleWebhook,
  startCheckout,
} from './billing.service.js';
import { InvalidSignatureError } from './provider.js';

/** Mounted at /api/v1/billing. */
export const billingRouter = Router();
billingRouter.use(requireUser);

billingRouter.get('/', async (req, res) => {
  res.json(await getBillingSummary(currentUser(req)));
});

/** Re-check an unfinished payment with the provider (the webhook may be late or missing). */
billingRouter.post('/check', async (req, res) => {
  res.json(await checkPendingPayment(currentUser(req)));
});

billingRouter.post('/checkout', async (req, res) => {
  const { interval } = parseBody(CheckoutInputSchema, req);
  res.json(await startCheckout(currentUser(req), interval));
});

/** Mounted at /webhooks/razorpay, before JSON parsing: the signature covers the raw bytes. */
export const razorpayWebhookRouter = Router();

razorpayWebhookRouter.post(
  '/',
  express.raw({ type: 'application/json', limit: '1mb' }),
  async (req, res) => {
    try {
      await handleWebhook(
        req.body as Buffer,
        req.get('x-razorpay-signature') ?? '',
        // Razorpay sends a unique id per event; retries of the same event repeat it.
        req.get('x-razorpay-event-id') ?? randomUUID(),
      );
      res.json({ received: true });
    } catch (err) {
      if (err instanceof InvalidSignatureError) {
        logger.warn('Razorpay webhook with an invalid signature');
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid signature' } });
        return;
      }
      throw err; // 500: Razorpay will retry.
    }
  },
);
