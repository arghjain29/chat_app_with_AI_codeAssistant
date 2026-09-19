import { PLANS } from '@codecollab/shared';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { billingQuery, useCancelSubscription, useCheckout } from '@/features/billing/api';
import { TestModeNote } from '@/features/billing/plan-cards';
import { usageQuery } from '@/features/chat/chat-api';
import { projectsQuery } from '@/features/projects/api';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_app/settings/billing')({
  loader: ({ context }) => context.queryClient.prefetchQuery(billingQuery),
  component: BillingSettings,
});

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

const STATUS_TEXT: Record<string, string> = {
  active: 'Active',
  trialing: 'Trial',
  past_due: 'Payment failed',
  unpaid: 'Unpaid',
  canceled: 'Canceled',
  incomplete: 'Waiting for payment',
  incomplete_expired: 'Expired',
  paused: 'Paused',
};

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
  const cancel = useCancelSubscription();
  const resume = useCheckout();
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (error) {
    return (
      <p className="mx-auto max-w-3xl px-4 py-16 text-danger">
        Couldn’t load billing: {error.message}
      </p>
    );
  }
  if (!billing) return <div className="mx-auto h-64 max-w-3xl animate-pulse px-4 py-16" />;

  const plan = PLANS[billing.plan];
  const sub = billing.subscription;
  const owned = projects?.filter((p) => p.role === 'owner').length ?? 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-10 pb-16">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Plan and billing</h1>

      <section className="mt-8 rounded-2xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-ink-muted">Current plan</p>
            <p className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold">
              {billing.plan === 'pro' && <Sparkles className="size-5 text-cobalt" aria-hidden />}
              {plan.name}
            </p>
            {sub && !['canceled', 'incomplete_expired'].includes(sub.status) ? (
              <p className="mt-2 text-sm text-ink-muted">
                <span
                  className={cn(
                    'mr-2 rounded-full px-2 py-0.5 text-xs font-medium',
                    sub.status === 'past_due' ? 'bg-danger/10 text-danger' : 'bg-teal/15 text-teal',
                  )}
                >
                  {STATUS_TEXT[sub.status] ?? sub.status}
                </span>
                {sub.currentPeriodEnd &&
                  (sub.cancelAtPeriodEnd
                    ? `Ends on ${formatDate(sub.currentPeriodEnd)}, then you move to Free.`
                    : `Renews ${sub.interval === 'year' ? 'yearly' : 'monthly'} on ${formatDate(sub.currentPeriodEnd)}.`)}
              </p>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">{plan.tagline}.</p>
            )}
            {sub?.status === 'past_due' && (
              <p className="mt-2 text-sm text-danger">
                Your last payment didn’t go through. Update your card to keep Pro.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {sub?.status === 'incomplete' && sub.interval && (
              <Button disabled={resume.isPending} onClick={() => resume.mutate(sub.interval!)}>
                Continue payment
              </Button>
            )}
            {billing.canCancel && (
              <Button variant="secondary" onClick={() => setConfirmCancel(true)}>
                Cancel subscription
              </Button>
            )}
            {billing.plan === 'free' && billing.enabled && sub?.status !== 'incomplete' && (
              <Button asChild>
                <Link to="/pricing" search={{ checkout: undefined }}>
                  <Sparkles /> Upgrade to Pro
                </Link>
              </Button>
            )}
          </div>
        </div>
        {sub?.cancelAtPeriodEnd && billing.plan === 'pro' && (
          <p className="mt-4 border-t border-line pt-4 text-xs text-ink-muted">
            You can upgrade again once this period ends.
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

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent
          title="Cancel your subscription?"
          description={
            sub?.currentPeriodEnd
              ? `You keep Pro until ${formatDate(sub.currentPeriodEnd)}, then move to Free. Nothing is deleted.`
              : 'You keep Pro until the end of this period, then move to Free. Nothing is deleted.'
          }
        >
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Keep Pro</Button>
            </DialogClose>
            <Button
              variant="danger"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate(undefined, { onSettled: () => setConfirmCancel(false) })}
            >
              {cancel.isPending ? 'Cancelling…' : 'Cancel subscription'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {billing.enabled && billing.testMode && (
        <div className="mt-6">
          <TestModeNote />
        </div>
      )}
      {!billing.enabled && (
        <p className="mt-6 text-sm text-ink-muted">Upgrades aren’t available on this server yet.</p>
      )}
    </div>
  );
}
