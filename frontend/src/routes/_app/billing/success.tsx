import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { meQuery } from '@/features/auth/use-me';
import { billingQuery } from '@/features/billing/api';
import { usageQuery } from '@/features/chat/chat-api';

export const Route = createFileRoute('/_app/billing/success')({
  component: CheckoutSuccess,
});

const GIVE_UP_AFTER_MS = 60_000;

/**
 * Where Stripe sends people after paying. Pro is switched on by Stripe's webhook, not by
 * this page, so it waits for the server to confirm.
 */
function CheckoutSuccess() {
  const qc = useQueryClient();
  const [startedAt] = useState(() => Date.now());
  const [timedOut, setTimedOut] = useState(false);
  const { data } = useQuery({
    ...billingQuery,
    refetchInterval: (q) => (q.state.data?.plan === 'pro' || timedOut ? false : 1500),
  });
  const confirmed = data?.plan === 'pro';

  useEffect(() => {
    if (confirmed) {
      void qc.invalidateQueries({ queryKey: meQuery.queryKey });
      void qc.invalidateQueries({ queryKey: usageQuery.queryKey });
      return;
    }
    const t = window.setTimeout(
      () => setTimedOut(true),
      GIVE_UP_AFTER_MS - (Date.now() - startedAt),
    );
    return () => window.clearTimeout(t);
  }, [confirmed, qc, startedAt]);

  return (
    <div className="mx-auto grid max-w-md place-items-center px-4 py-24 text-center">
      {confirmed ? (
        <>
          <CheckCircle2 className="size-12 text-teal" aria-hidden />
          <h1 className="mt-4 font-display text-3xl font-semibold">You’re on Pro</h1>
          <p className="mt-2 text-ink-muted">
            Unlimited projects, bigger teams and more AI are switched on. Thanks for supporting
            CodeCollab.
          </p>
          <Button asChild className="mt-6">
            <Link to="/dashboard">Back to your projects</Link>
          </Button>
        </>
      ) : timedOut ? (
        <>
          <h1 className="font-display text-2xl font-semibold">
            Payment received, still confirming
          </h1>
          <p className="mt-2 text-ink-muted">
            Stripe hasn’t confirmed the payment with us yet. It usually takes seconds; check your
            plan again in a minute.
          </p>
          <Button asChild variant="secondary" className="mt-6">
            <Link to="/settings/billing">Check my plan</Link>
          </Button>
        </>
      ) : (
        <>
          <Loader2 className="size-10 animate-spin text-cobalt" aria-hidden />
          <h1 className="mt-4 font-display text-2xl font-semibold" role="status">
            Confirming your payment…
          </h1>
          <p className="mt-2 text-ink-muted">This takes a few seconds.</p>
        </>
      )}
    </div>
  );
}
