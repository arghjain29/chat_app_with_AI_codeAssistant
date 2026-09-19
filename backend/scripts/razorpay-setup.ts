/**
 * One-time Razorpay setup: creates the monthly and yearly "CodeCollab Pro" plans, tagged so
 * the server can find them. Safe to run again: existing plans are reused.
 *
 *   npm run razorpay:setup -w backend
 */
import { PLAN_REFS, PLANS, PRICE_CURRENCY } from '@codecollab/shared';
import Razorpay from 'razorpay';

try {
  process.loadEnvFile();
} catch {
  // Use the real environment.
}
const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;
if (!keyId || !keySecret) {
  console.error('Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env first.');
  process.exit(1);
}
if (!keyId.startsWith('rzp_test_')) {
  console.error('Refusing to run with live keys. Use test keys (rzp_test_…).');
  process.exit(1);
}

const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
const { items } = await rzp.plans.all({ count: 100 });

for (const interval of ['month', 'year'] as const) {
  const ref = PLAN_REFS[interval];
  const existing = items.find((p) => p.notes?.ref === ref);
  if (existing) {
    console.log(`Plan ${ref} already exists: ${existing.id}`);
    continue;
  }
  const rupees = interval === 'month' ? PLANS.pro.price.monthly : PLANS.pro.price.yearly;
  const plan = await rzp.plans.create({
    period: interval === 'month' ? 'monthly' : 'yearly',
    interval: 1,
    item: {
      name: `CodeCollab Pro (${interval === 'month' ? 'monthly' : 'yearly'})`,
      amount: rupees * 100, // In paise.
      currency: PRICE_CURRENCY,
      description: PLANS.pro.tagline,
    },
    notes: { ref },
  });
  console.log(`Created plan ${ref}: ${plan.id}`);
}
console.log('Razorpay is ready.');
