import { INTERVAL_LABEL, PLANS, type BillingInterval } from '@codecollab/shared';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { billingQuery, useCheckout, useCheckPendingPayment } from '@/features/billing/api';
import { IntervalToggle, TestModeNote } from '@/features/billing/plan-cards';
import { usageQuery } from '@/features/chat/chat-api';
import { projectsQuery } from '@/features/projects/api';
import { formatInr } from '@/lib/format';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_app/settings/billing')({
  loader: ({ context }) => context.queryClient.prefetchQuery(billingQuery),
  component: BillingSettings,
});

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

const daysLeft = (iso: string) =>
  Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));

function Meter({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit === null ? 0 : Math.min(100, Math.round((used / limit) * 100));
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-ink-muted tabular-nums">
          {used} {limit === null ? 'used (no limit)' : `of ${limit}`}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className={cn('h-full rounded-full', pct >= 100 ? 'bg-danger' : 'bg-cobalt')}
          style={{ width: `${limit === null ? 4 : pct}%` }}
        />
      </div>
    </div>
  );
}

function BillingSettings() {
  const { data: billing, error } = useQuery(billingQuery);
  const { data: usage } = useQuery(usageQuery);
  const { data: projects } = useQuery(projectsQuery);
  const checkout = useCheckout();
  const [interval, setInterval] = useState<BillingInterval>('month');
  // An unfinished payment may simply be one whose webhook never arrived, so ask Razorpay.
  useCheckPendingPayment({ enabled: !!billing?.pending });

  if (error) {
    return (
      <p className="mx-auto max-w-3xl px-4 py-16 text-danger">
        Couldn’t load billing: {error.message}
      </p>
    );
  }
  if (!billing) return <div className="mx-auto h-64 max-w-3xl animate-pulse px-4 py-16" />;

  const plan = PLANS[billing.plan];
  const owned = projects?.filter((p) => p.role === 'owner').length ?? 0;
  const isPro = billing.plan === 'pro';
  const endsSoon = billing.proUntil ? daysLeft(billing.proUntil) <= 7 : false;
  const price = interval === 'month' ? PLANS.pro.price.monthly : PLANS.pro.price.yearly;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-10 pb-16">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Plan and billing</h1>

      <section className="mt-8 rounded-2xl border border-line bg-surface p-6">
        <p className="text-sm text-ink-muted">Current plan</p>
        <p className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold">
          {isPro && <Sparkles className="size-5 text-cobalt" aria-hidden />}
          {plan.name}
        </p>
        {isPro && billing.proUntil ? (
          <p className="mt-2 text-sm">
            <span
              className={cn(
                'mr-2 rounded-full px-2 py-0.5 text-xs font-medium',
                endsSoon ? 'bg-marigold/20 text-ink' : 'bg-teal/15 text-teal',
              )}
            >
              Pro until {formatDate(billing.proUntil)}
            </span>
            <span className="text-ink-muted">
              Nothing renews by itself. Extend whenever you like, and the time you have left is
              added on.
            </span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">{plan.tagline}.</p>
        )}

        {billing.pending && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3">
            <p className="text-sm">
              You have an unfinished payment for {INTERVAL_LABEL[billing.pending.interval]} of Pro.
              If you’ve already paid, this clears by itself in a moment.
            </p>
            <Button
              variant="secondary"
              disabled={checkout.isPending}
              onClick={() => checkout.mutate(billing.pending!.interval)}
            >
              Finish payment
            </Button>
          </div>
        )}

        {billing.enabled ? (
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-6">
            <IntervalToggle value={interval} onChange={setInterval} />
            <Button disabled={checkout.isPending} onClick={() => checkout.mutate(interval)}>
              <Sparkles />
              {checkout.isPending
                ? 'Opening Razorpay…'
                : `${isPro ? 'Extend' : 'Get'} Pro — ${formatInr(price)} for ${INTERVAL_LABEL[interval]}`}
            </Button>
          </div>
        ) : (
          <p className="mt-6 border-t border-line pt-6 text-sm text-ink-muted">
            Upgrades aren’t available on this server yet.
          </p>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-semibold">Usage</h2>
        <div className="mt-5 grid gap-6">
          <Meter label="Projects you own" used={owned} limit={plan.limits.maxOwnedProjects} />
          {usage && (
            <Meter
              label={`AI requests ${usage.aiRequests.period === 'day' ? 'today' : 'this month'}`}
              used={usage.aiRequests.used}
              limit={usage.aiRequests.limit}
            />
          )}
          <p className="text-sm text-ink-muted">
            Projects you own can hold up to {plan.limits.maxMembersPerProject - 1} collaborators.
          </p>
        </div>
      </section>

      {billing.enabled && billing.testMode && (
        <div className="mt-6">
          <TestModeNote />
        </div>
      )}
    </div>
  );
}
