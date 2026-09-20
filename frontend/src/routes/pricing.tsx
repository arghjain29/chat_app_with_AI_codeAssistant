import { Show, useAuth } from '@clerk/react';
import { INTERVAL_LABEL, type BillingInterval } from '@codecollab/shared';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { billingQuery, useCheckout } from '@/features/billing/api';
import { IntervalToggle, PlanCard, TestModeNote } from '@/features/billing/plan-cards';

export const Route = createFileRoute('/pricing')({
  validateSearch: (search: Record<string, unknown>) => ({
    checkout: search.checkout === 'canceled' ? ('canceled' as const) : undefined,
  }),
  component: Pricing,
});

const FAQ = [
  [
    'Does Pro renew by itself?',
    'No. You pay for a month or a year up front, and Pro runs until that date. There is nothing to cancel: if you don’t extend it, the account simply goes back to Free.',
  ],
  [
    'What happens to my projects when Pro ends?',
    'Nothing is deleted. If you own more projects than Free allows, you can still open and edit them, but you can’t create new ones until you extend Pro again.',
  ],
  [
    'Who pays when a project has several people?',
    'Only the owner. The owner’s plan decides how many people a project holds; everyone else can be on Free.',
  ],
  [
    'Do AI requests roll over?',
    'No. Free includes 30 a day and Pro 1,500 a month; unused requests reset with the period.',
  ],
] as const;

function Pricing() {
  const { checkout } = Route.useSearch(); // Kept for links from older flows.
  const { isSignedIn } = useAuth();
  const [interval, setBillingInterval] = useState<BillingInterval>('month');
  const { data: billing } = useQuery({ ...billingQuery, enabled: !!isSignedIn });
  const startCheckout = useCheckout();

  useEffect(() => {
    if (checkout === 'canceled') toast('Payment cancelled. You haven’t been charged.');
  }, [checkout]);

  const isPro = billing?.plan === 'pro';

  const proAction = !isSignedIn ? (
    <Button asChild size="lg" className="w-full">
      <Link to="/sign-up/$" params={{ _splat: '' }}>
        Start free, upgrade anytime
      </Link>
    </Button>
  ) : isPro ? (
    <Button asChild size="lg" variant="secondary" className="w-full">
      <Link to="/settings/billing">Manage your plan</Link>
    </Button>
  ) : (
    <Button
      size="lg"
      className="w-full"
      disabled={startCheckout.isPending || billing?.enabled === false}
      onClick={() => startCheckout.mutate(interval)}
    >
      {startCheckout.isPending ? 'Opening Razorpay…' : `Get Pro for ${INTERVAL_LABEL[interval]}`}
    </Button>
  );

  const freeAction = !isSignedIn ? (
    <Button asChild size="lg" variant="secondary" className="w-full">
      <Link to="/sign-up/$" params={{ _splat: '' }}>
        Create a free account
      </Link>
    </Button>
  ) : (
    <Button asChild size="lg" variant="secondary" className="w-full">
      <Link to="/dashboard">Go to your projects</Link>
    </Button>
  );

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Show when="signed-out">
            <Button asChild variant="ghost" size="sm">
              <Link to="/sign-in/$" params={{ _splat: '' }}>
                Sign in
              </Link>
            </Button>
          </Show>
          <Show when="signed-in">
            <Button asChild size="sm">
              <Link to="/dashboard">Open your projects</Link>
            </Button>
          </Show>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-10 pb-24">
        <div className="max-w-xl">
          <h1 className="font-display text-5xl font-bold tracking-tight [font-stretch:88%]">
            Pay when your team outgrows Free.
          </h1>
          <p className="mt-4 text-lg text-ink-muted">
            Free covers side projects with a couple of collaborators. Pro removes the project limit,
            gives the AI more room and brings in larger teams.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
          <IntervalToggle value={interval} onChange={setBillingInterval} />
          {billing?.enabled && billing.testMode && !isPro && (
            <div className="max-w-md">
              <TestModeNote />
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <PlanCard
            plan="free"
            interval={interval}
            current={!!isSignedIn && !isPro}
            action={freeAction}
          />
          <PlanCard plan="pro" interval={interval} current={isPro} action={proAction} />
        </div>
        {billing?.enabled === false && (
          <p className="mt-4 text-sm text-ink-muted">
            Upgrades aren’t available on this server yet.
          </p>
        )}

        <section className="mt-20 grid gap-8 md:grid-cols-[1fr_2fr]">
          <h2 className="font-display text-2xl font-semibold">Questions</h2>
          <dl className="grid gap-6">
            {FAQ.map(([q, a]) => (
              <div key={q}>
                <dt className="font-medium">{q}</dt>
                <dd className="mt-1 text-ink-muted">{a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </div>
  );
}
