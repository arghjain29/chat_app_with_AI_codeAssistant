import { PLANS, type BillingInterval, type PlanId } from '@codecollab/shared';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatInr } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Monthly / yearly switch. */
export function IntervalToggle({
  value,
  onChange,
}: {
  value: BillingInterval;
  onChange: (v: BillingInterval) => void;
}) {
  const saving = Math.round(100 - (PLANS.pro.price.yearly / (PLANS.pro.price.monthly * 12)) * 100);
  return (
    <div
      className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-sm"
      role="radiogroup"
      aria-label="Billing period"
    >
      {(['month', 'year'] as const).map((v) => (
        <button
          key={v}
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            'rounded-md px-3 py-1.5',
            value === v ? 'bg-ink text-paper font-medium' : 'text-ink-muted hover:text-ink',
          )}
        >
          {v === 'month' ? 'Monthly' : 'Yearly'}
          {v === 'year' && (
            <span className={cn('ml-1.5 text-xs', value === v ? 'text-marigold' : 'text-teal')}>
              save {saving}%
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function PlanCard({
  plan,
  interval,
  current,
  action,
}: {
  plan: PlanId;
  interval: BillingInterval;
  current?: boolean;
  action: ReactNode;
}) {
  const p = PLANS[plan];
  const price = interval === 'month' ? p.price.monthly : p.price.yearly;
  const featured = plan === 'pro';

  return (
    <section
      className={cn(
        'relative flex flex-col rounded-2xl border bg-surface p-7',
        featured ? 'border-cobalt shadow-[0_20px_50px_-30px_var(--cobalt)]' : 'border-line',
      )}
      aria-label={`${p.name} plan`}
    >
      {current && (
        <span className="absolute top-5 right-5 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium">
          Your plan
        </span>
      )}
      <h2 className="font-display text-2xl font-semibold">{p.name}</h2>
      <p className="mt-1 text-sm text-ink-muted">{p.tagline}</p>
      <p className="mt-6 flex items-baseline gap-1.5">
        <span className="font-display text-5xl font-semibold tracking-tight tabular-nums">
          {formatInr(price)}
        </span>
        <span className="text-sm text-ink-muted">
          {price === 0 ? 'forever' : interval === 'month' ? 'for a month' : 'for a year'}
        </span>
      </p>
      {plan === 'pro' && interval === 'year' && (
        <p className="mt-1 text-xs text-ink-muted">
          Works out at {formatInr(Math.round(p.price.yearly / 12))} a month
        </p>
      )}
      {plan === 'pro' && (
        <p className="mt-1 text-xs text-ink-muted">Paid up front, doesn’t renew by itself</p>
      )}
      <ul className="mt-6 grid gap-2.5 text-sm">
        {p.features.map((f) => (
          <li key={f} className="flex gap-2">
            <Check
              className={cn('mt-0.5 size-4 shrink-0', featured ? 'text-cobalt' : 'text-teal')}
              aria-hidden
            />
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-8">{action}</div>
    </section>
  );
}

/** Explains test-mode payments, with what to pay with. */
export function TestModeNote() {
  return (
    <p className="rounded-lg border border-marigold/50 bg-marigold/10 px-4 py-3 text-sm">
      <span className="font-medium">Payments are in test mode.</span> No real money moves. On the
      Razorpay page, pay with the UPI ID{' '}
      <code className="rounded bg-surface px-1 font-mono">success@razorpay</code> or one of
      Razorpay’s{' '}
      <a
        href="https://razorpay.com/docs/payments/payments/test-card-details/"
        target="_blank"
        rel="noreferrer"
        className="underline"
      >
        test cards
      </a>
      .
    </p>
  );
}
