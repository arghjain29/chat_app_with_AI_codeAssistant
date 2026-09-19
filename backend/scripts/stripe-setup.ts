/**
 * One-time Stripe setup: creates the "CodeCollab Pro" product with monthly and yearly
 * prices, found later by lookup key. Safe to run again: existing prices are reused.
 *
 *   npm run stripe:setup -w backend
 */
import { PLANS, PRICE_LOOKUP_KEYS } from '@codecollab/shared';
import Stripe from 'stripe';

try {
  process.loadEnvFile();
} catch {
  // Use the real environment.
}
const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('Set STRIPE_SECRET_KEY in backend/.env first.');
  process.exit(1);
}
if (!key.startsWith('sk_test_')) {
  console.error('Refusing to run with a live key. Use a test key (sk_test_…).');
  process.exit(1);
}

const stripe = new Stripe(key);
const existing = await stripe.prices.list({
  lookup_keys: Object.values(PRICE_LOOKUP_KEYS),
  active: true,
});
const found = new Set(existing.data.map((p) => p.lookup_key));

let productId = existing.data[0]
  ? typeof existing.data[0].product === 'string'
    ? existing.data[0].product
    : existing.data[0].product.id
  : null;
if (!productId) {
  const product = await stripe.products.create({
    name: 'CodeCollab Pro',
    description: PLANS.pro.features.join(' · '),
  });
  productId = product.id;
  console.log(`Created product ${product.id}`);
}

for (const interval of ['month', 'year'] as const) {
  const lookupKey = PRICE_LOOKUP_KEYS[interval];
  if (found.has(lookupKey)) {
    console.log(`Price ${lookupKey} already exists`);
    continue;
  }
  const price = await stripe.prices.create({
    product: productId,
    currency: 'usd',
    unit_amount: PLANS.pro.price[interval === 'month' ? 'monthly' : 'yearly'] * 100,
    recurring: { interval },
    lookup_key: lookupKey,
  });
  console.log(`Created price ${lookupKey}: ${price.id}`);
}
console.log('Stripe is ready.');
