import request from 'supertest';
import Stripe from 'stripe';
import { afterEach, describe, expect, it } from 'vitest';
import { ProcessedWebhookModel, SubscriptionModel } from '../src/modules/billing/billing.model.js';
import { setBillingProviderForTesting } from '../src/modules/billing/billing.service.js';
import {
  InvalidSignatureError,
  type BillingEvent,
  type BillingProvider,
  type ProviderSubscription,
} from '../src/modules/billing/provider.js';
import { stripeProvider } from '../src/modules/billing/stripe.provider.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { deleteUserByClerkId } from '../src/modules/users/user.service.js';
import { app, createProject, signUp } from './helpers.js';

const B = '/api/v1/billing';

/** A fake provider whose webhook payload is simply the event as JSON, signed with "good". */
function fakeProvider() {
  const calls = { checkouts: 0, portals: 0, canceled: [] as string[] };
  const provider: BillingProvider = {
    name: 'stripe',
    testMode: true,
    async ensureCustomer({ customerId }) {
      return customerId ?? 'cus_test_1';
    },
    async createCheckout({ interval }) {
      calls.checkouts++;
      return `https://checkout.stripe.test/${interval}`;
    },
    async createPortal() {
      calls.portals++;
      return 'https://billing.stripe.test/portal';
    },
    async parseWebhook(raw, signature) {
      if (signature !== 'good') throw new InvalidSignatureError('bad');
      return JSON.parse(raw.toString()) as BillingEvent;
    },
    async cancelNow(id) {
      calls.canceled.push(id);
    },
  };
  setBillingProviderForTesting(provider);
  return calls;
}

afterEach(() => setBillingProviderForTesting(undefined));

const subscription = (userId: string, status: ProviderSubscription['status']) => ({
  id: 'sub_1',
  customerId: 'cus_test_1',
  status,
  interval: 'month',
  currentPeriodEnd: new Date(Date.now() + 30 * 864e5).toISOString(),
  cancelAtPeriodEnd: false,
  userId,
});

const deliver = (event: object, signature = 'good') =>
  request(app)
    .post('/webhooks/stripe')
    .set('content-type', 'application/json')
    .set('stripe-signature', signature)
    .send(JSON.stringify(event));

describe('billing summary', () => {
  it('reports billing as off when no provider is configured', async () => {
    setBillingProviderForTesting(null);
    const alice = await signUp('alice');
    const res = await alice.client.get(B).expect(200);
    expect(res.body).toMatchObject({ plan: 'free', enabled: false, subscription: null });
    await alice.client.post(`${B}/checkout`, { interval: 'month' }).expect(503);
  });
});

describe('upgrading', () => {
  it('starts checkout and remembers the customer', async () => {
    const calls = fakeProvider();
    const alice = await signUp('alice');
    const res = await alice.client.post(`${B}/checkout`, { interval: 'year' }).expect(200);
    expect(res.body.url).toBe('https://checkout.stripe.test/year');
    expect(calls.checkouts).toBe(1);
    expect((await UserModel.findOne({ clerkId: 'alice' }))!.stripeCustomerId).toBe('cus_test_1');
  });

  it('turns Pro on only when the provider confirms, and applies Pro limits', async () => {
    fakeProvider();
    const alice = await signUp('alice');
    await alice.client.post(`${B}/checkout`, { interval: 'month' }).expect(200);
    expect((await alice.client.get(B)).body.plan).toBe('free'); // Checkout alone grants nothing.

    await deliver({
      id: 'evt_1',
      kind: 'subscription',
      subscription: subscription(alice.id, 'active'),
    }).expect(200);
    const res = await alice.client.get(B).expect(200);
    expect(res.body).toMatchObject({
      plan: 'pro',
      subscription: { status: 'active', interval: 'month', cancelAtPeriodEnd: false },
      canManage: true,
    });

    // Pro has no project limit.
    for (let i = 0; i < 5; i++) await createProject(alice.client, `p${i}`);
    await alice.client.post(`${B}/checkout`, { interval: 'month' }).expect(409);
  });

  it('keeps Pro while a payment is retried, and ends it on cancellation', async () => {
    fakeProvider();
    const alice = await signUp('alice');
    await alice.client.post(`${B}/checkout`, {}).expect(200);
    await deliver({
      id: 'evt_1',
      kind: 'subscription',
      subscription: subscription(alice.id, 'active'),
    });
    await deliver({
      id: 'evt_2',
      kind: 'subscription',
      subscription: subscription(alice.id, 'past_due'),
    });
    expect((await alice.client.get(B)).body.plan).toBe('pro');

    await deliver({
      id: 'evt_3',
      kind: 'subscription',
      subscription: subscription(alice.id, 'canceled'),
    });
    const res = await alice.client.get(B).expect(200);
    expect(res.body).toMatchObject({ plan: 'free', subscription: { status: 'canceled' } });
  });
});

describe('webhooks', () => {
  it('rejects unsigned deliveries', async () => {
    fakeProvider();
    await deliver({ id: 'evt_x', kind: 'ignored', type: 'x' }, 'forged').expect(400);
  });

  it('processes each event once, however often it is retried', async () => {
    fakeProvider();
    const alice = await signUp('alice');
    const event = {
      id: 'evt_1',
      kind: 'subscription',
      subscription: subscription(alice.id, 'active'),
    };
    await deliver(event).expect(200);
    await SubscriptionModel.updateOne({}, { status: 'canceled' }); // Would be overwritten if replayed.
    await deliver(event).expect(200);
    expect((await SubscriptionModel.findOne())!.status).toBe('canceled');
    expect(await ProcessedWebhookModel.countDocuments()).toBe(1);
  });

  it('checks real Stripe signatures', async () => {
    const secret = 'whsec_test_secret';
    setBillingProviderForTesting(stripeProvider('sk_test_fake', secret));
    const payload = JSON.stringify({
      id: 'evt_real',
      object: 'event',
      type: 'invoice.paid',
      data: { object: {} },
    });
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });

    await request(app)
      .post('/webhooks/stripe')
      .set('content-type', 'application/json')
      .set('stripe-signature', header)
      .send(payload)
      .expect(200);
    await request(app)
      .post('/webhooks/stripe')
      .set('content-type', 'application/json')
      .set('stripe-signature', header)
      .send(payload.replace('invoice.paid', 'invoice.hacked'))
      .expect(400);
  });
});

describe('managing billing', () => {
  it('opens the portal only for customers', async () => {
    const calls = fakeProvider();
    const alice = await signUp('alice');
    await alice.client.post(`${B}/portal`).expect(409);
    await alice.client.post(`${B}/checkout`, {}).expect(200);
    const res = await alice.client.post(`${B}/portal`).expect(200);
    expect(res.body.url).toBe('https://billing.stripe.test/portal');
    expect(calls.portals).toBe(1);
  });

  it('cancels the subscription when the account is deleted', async () => {
    const calls = fakeProvider();
    const alice = await signUp('alice');
    await alice.client.post(`${B}/checkout`, {}).expect(200);
    await deliver({
      id: 'evt_1',
      kind: 'subscription',
      subscription: subscription(alice.id, 'active'),
    });

    await deleteUserByClerkId('alice');
    expect(calls.canceled).toEqual(['sub_1']);
    expect(await SubscriptionModel.countDocuments()).toBe(0);
  });
});
