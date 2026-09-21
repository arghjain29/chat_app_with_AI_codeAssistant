import { createHmac } from 'node:crypto';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { ProcessedWebhookModel, ProPassModel } from '../src/modules/billing/billing.model.js';
import {
  adminGrantPro,
  adminRevokePro,
  setBillingProviderForTesting,
} from '../src/modules/billing/billing.service.js';
import {
  InvalidSignatureError,
  type BillingEvent,
  type BillingProvider,
  type CheckoutStatus,
  type PaymentRecord,
} from '../src/modules/billing/provider.js';
import { razorpayProvider } from '../src/modules/billing/razorpay.provider.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { deleteUserByClerkId } from '../src/modules/users/user.service.js';
import { app, createProject, signUp } from './helpers.js';

const B = '/api/v1/billing';
const DAY = 864e5;

/** A fake provider whose webhook payload is simply the event as JSON, signed with "good". */
function fakeProvider() {
  const calls = { checkouts: 0, canceled: [] as string[], statusChecks: [] as string[] };
  /** What the provider will say the next time a payment page is looked up. */
  const status: { next: CheckoutStatus } = { next: { state: 'open' } };
  const provider: BillingProvider = {
    name: 'razorpay',
    testMode: true,
    async createCheckout({ interval }) {
      calls.checkouts++;
      return {
        linkId: `link_${calls.checkouts}`,
        url: `https://rzp.test/${interval}/${calls.checkouts}`,
      };
    },
    async cancelCheckout(id) {
      calls.canceled.push(id);
    },
    async checkoutStatus(id) {
      calls.statusChecks.push(id);
      return status.next;
    },
    async parseWebhook(raw, signature, eventId) {
      if (signature !== 'good') throw new InvalidSignatureError('bad');
      return { ...(JSON.parse(raw.toString()) as BillingEvent), id: eventId };
    },
  };
  setBillingProviderForTesting(provider);
  return { calls, status };
}

afterEach(() => setBillingProviderForTesting(undefined));

let eventCounter = 0;
const deliver = (event: object, { signature = 'good', eventId = `evt_${++eventCounter}` } = {}) =>
  request(app)
    .post('/webhooks/razorpay')
    .set('content-type', 'application/json')
    .set('x-razorpay-signature', signature)
    .set('x-razorpay-event-id', eventId)
    .send(JSON.stringify(event));

/** A paid payment page, as the provider would report it. */
const paid = (
  linkId: string,
  userId: string,
  { paymentId = `pay_${linkId}`, interval = 'month' } = {},
) => ({ kind: 'paid', payment: { linkId, paymentId, userId, interval } });

const daysFromNow = (iso: string) => Math.round((new Date(iso).getTime() - Date.now()) / DAY);

describe('billing summary', () => {
  it('reports billing as off when no provider is configured', async () => {
    setBillingProviderForTesting(null);
    const alice = await signUp('alice');
    const res = await alice.client.get(B).expect(200);
    expect(res.body).toMatchObject({ plan: 'free', enabled: false, proUntil: null, pending: null });
    await alice.client.post(`${B}/checkout`, { interval: 'month' }).expect(503);
  });
});

describe('buying Pro', () => {
  it('returns the hosted payment page and reuses it if reopened', async () => {
    const { calls } = fakeProvider();
    const alice = await signUp('alice');
    const first = await alice.client.post(`${B}/checkout`, { interval: 'year' }).expect(200);
    expect(first.body.url).toBe('https://rzp.test/year/1');
    const again = await alice.client.post(`${B}/checkout`, { interval: 'year' }).expect(200);
    expect(again.body.url).toBe(first.body.url);
    expect(calls.checkouts).toBe(1);

    const summary = await alice.client.get(B).expect(200);
    expect(summary.body.pending).toEqual({ url: first.body.url, interval: 'year' });
  });

  it('replaces an unpaid payment page when the period changes', async () => {
    const { calls } = fakeProvider();
    const alice = await signUp('alice');
    await alice.client.post(`${B}/checkout`, { interval: 'month' }).expect(200);
    const res = await alice.client.post(`${B}/checkout`, { interval: 'year' }).expect(200);
    expect(res.body.url).toBe('https://rzp.test/year/2');
    expect(calls.canceled).toEqual(['link_1']);
  });

  it('turns Pro on only when the payment is confirmed, and applies Pro limits', async () => {
    fakeProvider();
    const alice = await signUp('alice');
    await alice.client.post(`${B}/checkout`, { interval: 'month' }).expect(200);
    expect((await alice.client.get(B)).body.plan).toBe('free'); // Checkout alone grants nothing.

    await deliver(paid('link_1', alice.id)).expect(200);
    const res = await alice.client.get(B).expect(200);
    expect(res.body).toMatchObject({ plan: 'pro', interval: 'month', pending: null });
    expect(daysFromNow(res.body.proUntil)).toBeGreaterThan(27);

    for (let i = 0; i < 5; i++) await createProject(alice.client, `p${i}`);
  });

  it('adds a renewal to the time that is left', async () => {
    fakeProvider();
    const alice = await signUp('alice');
    await alice.client.post(`${B}/checkout`, { interval: 'month' }).expect(200);
    await deliver(paid('link_1', alice.id)).expect(200);

    await alice.client.post(`${B}/checkout`, { interval: 'year' }).expect(200);
    await deliver(paid('link_2', alice.id, { interval: 'year' })).expect(200);

    const res = await alice.client.get(B).expect(200);
    expect(res.body.interval).toBe('year');
    expect(daysFromNow(res.body.proUntil)).toBeGreaterThan(390); // A year on top of the month.
  });

  it('applies a payment once, even if it is reported again', async () => {
    fakeProvider();
    const alice = await signUp('alice');
    await alice.client.post(`${B}/checkout`, { interval: 'month' }).expect(200);
    await deliver(paid('link_1', alice.id)).expect(200);
    const first = (await alice.client.get(B)).body.proUntil;

    await deliver(paid('link_1', alice.id)).expect(200); // Same payment, new event id.
    expect((await alice.client.get(B)).body.proUntil).toBe(first);
  });

  it('does not re-apply an older payment reported after a newer one', async () => {
    fakeProvider();
    const alice = await signUp('alice');
    await alice.client.post(`${B}/checkout`, { interval: 'month' }).expect(200);
    await deliver(paid('link_1', alice.id)).expect(200);
    await alice.client.post(`${B}/checkout`, { interval: 'month' }).expect(200);
    await deliver(paid('link_2', alice.id)).expect(200);
    const both = (await alice.client.get(B)).body.proUntil;

    await deliver(paid('link_1', alice.id)).expect(200); // The first one again, new event id.
    expect((await alice.client.get(B)).body.proUntil).toBe(both);
  });

  it('forgets a payment page that expires unpaid', async () => {
    fakeProvider();
    const alice = await signUp('alice');
    await alice.client.post(`${B}/checkout`, { interval: 'month' }).expect(200);
    await deliver({ kind: 'link-closed', linkId: 'link_1' }).expect(200);

    const res = await alice.client.get(B).expect(200);
    expect(res.body).toMatchObject({ plan: 'free', pending: null });
  });
});

describe('checking a payment directly', () => {
  it('turns Pro on when the webhook never arrives', async () => {
    const { calls, status } = fakeProvider();
    const alice = await signUp('alice');
    await alice.client.post(`${B}/checkout`, { interval: 'month' }).expect(200);

    // Nothing has been reported yet, so the payment page is still open.
    let res = await alice.client.post(`${B}/check`).expect(200);
    expect(res.body).toMatchObject({ plan: 'free', pending: { interval: 'month' } });

    status.next = {
      state: 'paid',
      payment: { linkId: 'link_1', paymentId: 'pay_1', userId: alice.id, interval: 'month' },
    };
    res = await alice.client.post(`${B}/check`).expect(200);
    expect(res.body).toMatchObject({ plan: 'pro', pending: null });
    expect(calls.statusChecks).toEqual(['link_1', 'link_1']);

    // With nothing pending, there is nothing left to ask about.
    await alice.client.post(`${B}/check`).expect(200);
    expect(calls.statusChecks).toHaveLength(2);
  });

  it('does not extend Pro twice when the webhook arrives as well', async () => {
    const { status } = fakeProvider();
    const alice = await signUp('alice');
    await alice.client.post(`${B}/checkout`, { interval: 'month' }).expect(200);
    const payment: PaymentRecord = {
      linkId: 'link_1',
      paymentId: 'pay_1',
      userId: alice.id,
      interval: 'month',
    };

    status.next = { state: 'paid', payment };
    const checked = await alice.client.post(`${B}/check`).expect(200);
    await deliver({ kind: 'paid', payment }).expect(200);
    expect((await alice.client.get(B)).body.proUntil).toBe(checked.body.proUntil);
  });

  it('forgets a payment page the provider says is closed', async () => {
    const { status } = fakeProvider();
    const alice = await signUp('alice');
    await alice.client.post(`${B}/checkout`, { interval: 'month' }).expect(200);

    status.next = { state: 'closed' };
    const res = await alice.client.post(`${B}/check`).expect(200);
    expect(res.body).toMatchObject({ plan: 'free', pending: null });
  });
});

describe('refunds', () => {
  const refund = (paymentId: string, full = true) => ({ kind: 'refunded', paymentId, full });

  /** Buy a month, then a year on top: about 13 months of Pro from two payments. */
  async function twoPayments() {
    fakeProvider();
    const alice = await signUp('alice');
    await alice.client.post(`${B}/checkout`, { interval: 'month' }).expect(200);
    await deliver(paid('link_1', alice.id)).expect(200);
    await alice.client.post(`${B}/checkout`, { interval: 'year' }).expect(200);
    await deliver(paid('link_2', alice.id, { interval: 'year' })).expect(200);
    return alice;
  }

  it('takes back exactly the time the refunded payment added', async () => {
    const alice = await twoPayments();
    await deliver(refund('pay_link_1')).expect(200);

    const res = await alice.client.get(B).expect(200);
    expect(res.body.plan).toBe('pro');
    const left = daysFromNow(res.body.proUntil);
    expect(left).toBeGreaterThanOrEqual(364); // The year is kept; only the month went back.
    expect(left).toBeLessThanOrEqual(366);
  });

  it('puts the account back on Free straight away when nothing is left', async () => {
    fakeProvider();
    const alice = await signUp('alice');
    await alice.client.post(`${B}/checkout`, { interval: 'month' }).expect(200);
    await deliver(paid('link_1', alice.id)).expect(200);

    await deliver(refund('pay_link_1')).expect(200);
    const res = await alice.client.get(B).expect(200);
    expect(res.body).toMatchObject({ plan: 'free', proUntil: null });
  });

  it('takes the time back once, however often the refund is reported', async () => {
    const alice = await twoPayments();
    await deliver(refund('pay_link_1')).expect(200);
    const once = (await alice.client.get(B)).body.proUntil;

    await deliver(refund('pay_link_1')).expect(200); // Same refund, new event id.
    expect((await alice.client.get(B)).body.proUntil).toBe(once);
  });

  it('leaves Pro alone after a partial refund', async () => {
    const alice = await twoPayments();
    const before = (await alice.client.get(B)).body.proUntil;
    await deliver(refund('pay_link_1', false)).expect(200);
    expect((await alice.client.get(B)).body.proUntil).toBe(before);
  });

  it('ignores refunds for payments that never granted Pro', async () => {
    const alice = await twoPayments();
    const before = (await alice.client.get(B)).body.proUntil;
    await deliver(refund('pay_somewhere_else')).expect(200);
    expect((await alice.client.get(B)).body.proUntil).toBe(before);
  });
});

describe('granting Pro by hand', () => {
  it('adds a month or a number of days, stacking like a payment', async () => {
    const alice = await signUp('alice');
    const user = (await UserModel.findById(alice.id))!;

    await adminGrantPro(user, 'month');
    let res = await alice.client.get(B).expect(200);
    expect(res.body.plan).toBe('pro');
    const month = daysFromNow(res.body.proUntil);
    expect(month).toBeGreaterThanOrEqual(28);

    await adminGrantPro(user, { days: 10 });
    res = await alice.client.get(B).expect(200);
    expect(daysFromNow(res.body.proUntil)).toBe(month + 10);

    const pass = await ProPassModel.findOne({ userId: alice.id });
    expect(pass!.grants.map((g) => g.source)).toEqual(['admin', 'admin']);
  });

  it('revokes Pro immediately, whatever was paid', async () => {
    fakeProvider();
    const alice = await signUp('alice');
    await alice.client.post(`${B}/checkout`, { interval: 'year' }).expect(200);
    await deliver(paid('link_1', alice.id, { interval: 'year' })).expect(200);

    await adminRevokePro((await UserModel.findById(alice.id))!);
    const res = await alice.client.get(B).expect(200);
    expect(res.body).toMatchObject({ plan: 'free', proUntil: null });
  });
});

describe('when Pro runs out', () => {
  it('moves the account back to Free', async () => {
    fakeProvider();
    const alice = await signUp('alice');
    await alice.client.post(`${B}/checkout`, { interval: 'month' }).expect(200);
    await deliver(paid('link_1', alice.id)).expect(200);

    await UserModel.updateOne({ _id: alice.id }, { proUntil: new Date(Date.now() - DAY) });
    const res = await alice.client.get(B).expect(200);
    expect(res.body).toMatchObject({ plan: 'free', proUntil: null });
  });

  it('closes an unpaid payment page when the account is deleted', async () => {
    const { calls } = fakeProvider();
    const alice = await signUp('alice');
    await alice.client.post(`${B}/checkout`, { interval: 'month' }).expect(200);

    await deleteUserByClerkId('alice');
    expect(calls.canceled).toEqual(['link_1']);
    expect(await ProPassModel.countDocuments()).toBe(0);
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
    await alice.client.post(`${B}/checkout`, { interval: 'month' }).expect(200);
    const event = paid('link_1', alice.id);
    await deliver(event, { eventId: 'evt_same' }).expect(200);

    // Forget the payment itself, so only the event id stands between a retry and a second grant.
    await ProPassModel.updateOne({}, { lastPaymentId: null, grants: [] });
    const before = (await alice.client.get(B)).body.proUntil;
    await deliver(event, { eventId: 'evt_same' }).expect(200);
    expect((await alice.client.get(B)).body.proUntil).toBe(before);
    expect(await ProcessedWebhookModel.countDocuments()).toBe(1);
  });

  it('reads a real Razorpay refund', async () => {
    const provider = razorpayProvider('rzp_test_fake', 'key_secret', 'secret');
    const event = (refund_status: 'full' | 'partial', amount_refunded: number) => {
      const body = JSON.stringify({
        event: 'payment.refunded',
        payload: {
          payment: {
            entity: { id: 'pay_123', amount: 79900, amount_refunded, refund_status },
          },
        },
      });
      const signature = createHmac('sha256', 'secret').update(body).digest('hex');
      return provider.parseWebhook(Buffer.from(body), signature, 'evt_refund');
    };

    await expect(event('full', 79900)).resolves.toEqual({
      id: 'evt_refund',
      kind: 'refunded',
      paymentId: 'pay_123',
      full: true,
    });
    await expect(event('partial', 20000)).resolves.toMatchObject({ full: false });
  });

  it('checks real Razorpay signatures', async () => {
    const secret = 'webhook_test_secret';
    setBillingProviderForTesting(razorpayProvider('rzp_test_fake', 'key_secret', secret));
    // An event we don't act on, so this exercises only the signature check.
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
