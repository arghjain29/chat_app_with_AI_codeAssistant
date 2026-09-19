import { createHmac } from 'node:crypto';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { ProcessedWebhookModel, SubscriptionModel } from '../src/modules/billing/billing.model.js';
import { setBillingProviderForTesting } from '../src/modules/billing/billing.service.js';
import {
  InvalidSignatureError,
  type BillingEvent,
  type BillingProvider,
  type ProviderSubscription,
} from '../src/modules/billing/provider.js';
import { razorpayProvider } from '../src/modules/billing/razorpay.provider.js';
import { deleteUserByClerkId } from '../src/modules/users/user.service.js';
import { app, createProject, signUp } from './helpers.js';

const B = '/api/v1/billing';

/** A fake provider whose webhook payload is simply the event as JSON, signed with "good". */
function fakeProvider() {
  const calls = { checkouts: 0, cancelAtEnd: [] as string[], canceledNow: [] as string[] };
  const provider: BillingProvider = {
    name: 'razorpay',
    testMode: true,
    async createCheckout({ interval }) {
      calls.checkouts++;
      return {
        subscriptionId: `sub_${calls.checkouts}`,
        url: `https://rzp.test/${interval}/${calls.checkouts}`,
      };
    },
    async cancelAtPeriodEnd(id) {
      calls.cancelAtEnd.push(id);
    },
    async cancelNow(id) {
      calls.canceledNow.push(id);
    },
    async parseWebhook(raw, signature, eventId) {
      if (signature !== 'good') throw new InvalidSignatureError('bad');
      return { ...(JSON.parse(raw.toString()) as BillingEvent), id: eventId };
    },
  };
  setBillingProviderForTesting(provider);
  return calls;
}

afterEach(() => setBillingProviderForTesting(undefined));

const subscription = (id: string, userId: string, status: ProviderSubscription['status']) => ({
  id,
  status,
  interval: 'month',
  currentPeriodEnd: new Date(Date.now() + 30 * 864e5).toISOString(),
  userId,
});

let eventCounter = 0;
const deliver = (event: object, { signature = 'good', eventId = `evt_${++eventCounter}` } = {}) =>
  request(app)
    .post('/webhooks/razorpay')
    .set('content-type', 'application/json')
    .set('x-razorpay-signature', signature)
    .set('x-razorpay-event-id', eventId)
    .send(JSON.stringify(event));

const becomes = (subId: string, userId: string, status: ProviderSubscription['status']) =>
  deliver({ kind: 'subscription', subscription: subscription(subId, userId, status) }).expect(200);

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
  it('returns the hosted payment page and reuses it if reopened', async () => {
    const calls = fakeProvider();
    const alice = await signUp('alice');
    const first = await alice.client.post(`${B}/checkout`, { interval: 'year' }).expect(200);
    expect(first.body.url).toBe('https://rzp.test/year/1');
    const again = await alice.client.post(`${B}/checkout`, { interval: 'year' }).expect(200);
    expect(again.body.url).toBe(first.body.url);
    expect(calls.checkouts).toBe(1);
  });

  it('replaces an unpaid checkout when the period changes', async () => {
    const calls = fakeProvider();
    const alice = await signUp('alice');
    await alice.client.post(`${B}/checkout`, { interval: 'month' }).expect(200);
    const res = await alice.client.post(`${B}/checkout`, { interval: 'year' }).expect(200);
    expect(res.body.url).toBe('https://rzp.test/year/2');
    expect(calls.canceledNow).toEqual(['sub_1']);
  });

  it('turns Pro on only when the provider confirms, and applies Pro limits', async () => {
    fakeProvider();
    const alice = await signUp('alice');
    await alice.client.post(`${B}/checkout`, { interval: 'month' }).expect(200);
    expect((await alice.client.get(B)).body.plan).toBe('free'); // Checkout alone grants nothing.

    await becomes('sub_1', alice.id, 'active');
    const res = await alice.client.get(B).expect(200);
    expect(res.body).toMatchObject({
      plan: 'pro',
      subscription: { status: 'active', interval: 'month', cancelAtPeriodEnd: false },
      canCancel: true,
    });

    for (let i = 0; i < 5; i++) await createProject(alice.client, `p${i}`);
    await alice.client.post(`${B}/checkout`, { interval: 'month' }).expect(409);
  });

  it('keeps Pro while a renewal is retried, and ends it when the subscription stops', async () => {
    fakeProvider();
    const alice = await signUp('alice');
    await alice.client.post(`${B}/checkout`, {}).expect(200);
    await becomes('sub_1', alice.id, 'active');
    await becomes('sub_1', alice.id, 'past_due');
    expect((await alice.client.get(B)).body.plan).toBe('pro');

    await becomes('sub_1', alice.id, 'unpaid');
    expect((await alice.client.get(B)).body.plan).toBe('free');
  });

  it('ignores late news about a replaced checkout', async () => {
    fakeProvider();
    const alice = await signUp('alice');
    await alice.client.post(`${B}/checkout`, { interval: 'month' }).expect(200);
    await alice.client.post(`${B}/checkout`, { interval: 'year' }).expect(200);
    await becomes('sub_2', alice.id, 'active');
    await becomes('sub_1', alice.id, 'canceled'); // The abandoned one, cancelled late.
    expect((await alice.client.get(B)).body.plan).toBe('pro');
  });
});

describe('cancelling', () => {
  it('keeps Pro until the period ends', async () => {
    const calls = fakeProvider();
    const alice = await signUp('alice');
    await alice.client.post(`${B}/checkout`, {}).expect(200);
    await becomes('sub_1', alice.id, 'active');

    const res = await alice.client.post(`${B}/cancel`).expect(200);
    expect(res.body).toMatchObject({
      plan: 'pro',
      subscription: { cancelAtPeriodEnd: true },
      canCancel: false,
    });
    expect(calls.cancelAtEnd).toEqual(['sub_1']);
    await alice.client.post(`${B}/cancel`).expect(409);

    // A renewal-time update doesn't forget the scheduled cancellation...
    await becomes('sub_1', alice.id, 'active');
    expect((await alice.client.get(B)).body.subscription.cancelAtPeriodEnd).toBe(true);
    // ...and when Razorpay ends it, Pro ends.
    await becomes('sub_1', alice.id, 'canceled');
    expect((await alice.client.get(B)).body.plan).toBe('free');
  });

  it('refuses when there is nothing to cancel', async () => {
    fakeProvider();
    const alice = await signUp('alice');
    await alice.client.post(`${B}/cancel`).expect(409);
  });

  it('stops charging when the account is deleted', async () => {
    const calls = fakeProvider();
    const alice = await signUp('alice');
    await alice.client.post(`${B}/checkout`, {}).expect(200);
    await becomes('sub_1', alice.id, 'active');

    await deleteUserByClerkId('alice');
    expect(calls.canceledNow).toEqual(['sub_1']);
    expect(await SubscriptionModel.countDocuments()).toBe(0);
  });
});

describe('webhooks', () => {
  it('rejects unsigned deliveries', async () => {
    fakeProvider();
    await deliver({ kind: 'ignored', type: 'x' }, { signature: 'forged' }).expect(400);
  });

  it('processes each event once, however often it is retried', async () => {
    fakeProvider();
    const alice = await signUp('alice');
    await alice.client.post(`${B}/checkout`, {}).expect(200);
    const event = { kind: 'subscription', subscription: subscription('sub_1', alice.id, 'active') };
    await deliver(event, { eventId: 'evt_same' }).expect(200);
    await SubscriptionModel.updateOne({}, { status: 'canceled' }); // Would be overwritten if replayed.
    await deliver(event, { eventId: 'evt_same' }).expect(200);
    expect((await SubscriptionModel.findOne())!.status).toBe('canceled');
    expect(await ProcessedWebhookModel.countDocuments()).toBe(1);
  });

  it('checks real Razorpay signatures', async () => {
    const secret = 'webhook_test_secret';
    setBillingProviderForTesting(razorpayProvider('rzp_test_fake', 'key_secret', secret));
    // A non-subscription event needs no API call, so this exercises only the signature check.
    const payload = JSON.stringify({ event: 'payment.captured', payload: {} });
    const signature = createHmac('sha256', secret).update(payload).digest('hex');
    const send = (body: string) =>
      request(app)
        .post('/webhooks/razorpay')
        .set('content-type', 'application/json')
        .set('x-razorpay-signature', signature)
        .set('x-razorpay-event-id', 'evt_real')
        .send(body);

    await send(payload).expect(200);
    await send(payload.replace('captured', 'refunded')).expect(400);
  });
});
