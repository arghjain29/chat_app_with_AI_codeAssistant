/**
 * Look up, grant or revoke Pro by hand.
 *
 *   npm run pro -w backend -- show   someone@example.com
 *   npm run pro -w backend -- grant  someone@example.com month   (or: year, or a number of days)
 *   npm run pro -w backend -- revoke someone@example.com
 *
 * It uses MONGO_URI from backend/.env. To change production, run it with MONGO_URI set to
 * the production database; the database it connected to is printed before anything changes.
 * Revoking ends Pro only — refund the payment in Razorpay separately if money is owed.
 */
import mongoose from 'mongoose';
import { env } from '../src/env.js';
import { connectDB, disconnectDB } from '../src/lib/db.js';
import { ProPassModel } from '../src/modules/billing/billing.model.js';
import { adminGrantPro, adminRevokePro } from '../src/modules/billing/billing.service.js';
import { UserModel, type UserDoc } from '../src/modules/users/user.model.js';

const USAGE = 'Usage: npm run pro -w backend -- <show|grant|revoke> <email> [month|year|<days>]';

const [action, email, amountArg] = process.argv.slice(2);
if (!action || !email || !['show', 'grant', 'revoke'].includes(action)) {
  console.error(USAGE);
  process.exit(1);
}

function parseAmount(raw: string | undefined) {
  if (raw === 'month' || raw === 'year') return raw;
  const days = Number(raw);
  if (Number.isInteger(days) && days > 0 && days <= 3660) return { days };
  console.error(`Say how much Pro to add: month, year, or a number of days.\n${USAGE}`);
  process.exit(1);
}

const describe = async (user: UserDoc) => {
  const pass = await ProPassModel.findOne({ userId: user._id });
  const until = user.proUntil ? user.proUntil.toISOString().slice(0, 10) : '—';
  console.log(`  ${user.email} (${user.username}): ${user.plan}, Pro until ${until}`);
  for (const g of pass?.grants ?? []) {
    const refunded = g.refundedAt ? `, refunded ${g.refundedAt.toISOString().slice(0, 10)}` : '';
    const days = Math.round(g.addedMs / 864e5);
    console.log(`    ${g.at.toISOString().slice(0, 10)}  +${days}d  ${g.paymentId}${refunded}`);
  }
};

const amount = action === 'grant' ? parseAmount(amountArg) : null;

await connectDB(env.MONGO_URI);
try {
  const { host, name } = mongoose.connection;
  console.log(`Database: ${host} / ${name}`);

  const user = await UserModel.findOne({ email: email.toLowerCase() });
  if (!user) {
    console.error(`No user with the email ${email}.`);
    process.exitCode = 1;
  } else {
    if (action === 'grant') await adminGrantPro(user, amount!);
    if (action === 'revoke') await adminRevokePro(user);
    await describe(user);
  }
} finally {
  await disconnectDB();
}
