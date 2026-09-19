import { CheckoutInputSchema } from '@codecollab/shared';
import express, { Router } from 'express';
import { logger } from '../../lib/logger.js';
import { currentUser, requireUser } from '../../middleware/auth.js';
import { parseBody } from '../../middleware/validate.js';
import { getBillingSummary, handleWebhook, openPortal, startCheckout } from './billing.service.js';
import { InvalidSignatureError } from './provider.js';

/** Mounted at /api/v1/billing. */
export const billingRouter = Router();
billingRouter.use(requireUser);

billingRouter.get('/', async (req, res) => {
  res.json(await getBillingSummary(currentUser(req)));
});

billingRouter.post('/checkout', async (req, res) => {
  const { interval } = parseBody(CheckoutInputSchema, req);
  res.json(await startCheckout(currentUser(req), interval));
});

billingRouter.post('/portal', async (req, res) => {
  res.json(await openPortal(currentUser(req)));
});

/** Mounted at /webhooks/stripe, before JSON parsing: the signature covers the raw bytes. */
export const stripeWebhookRouter = Router();

stripeWebhookRouter.post(
  '/',
  express.raw({ type: 'application/json', limit: '1mb' }),
  async (req, res) => {
    try {
      await handleWebhook(req.body as Buffer, req.get('stripe-signature') ?? '');
      res.json({ received: true });
    } catch (err) {
      if (err instanceof InvalidSignatureError) {
        logger.warn('Stripe webhook with an invalid signature');
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid signature' } });
        return;
      }
      throw err; // 500: Stripe will retry.
    }
  },
);
