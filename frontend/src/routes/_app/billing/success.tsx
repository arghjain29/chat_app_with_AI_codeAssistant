import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { meQuery } from '@/features/auth/use-me';
import { billingQuery } from '@/features/billing/api';
import { usageQuery } from '@/features/chat/chat-api';

export const Route = createFileRoute('/_app/billing/success')({
  component: CheckoutWaiting,
});

// Paying takes a while in the other tab, so wait much longer than the webhook itself needs.
const GIVE_UP_AFTER_MS = 10 * 60_000;

/**
 * Shown while the person pays in the Razorpay tab. Pro is switched on by Razorpay's webhook,
 * not by this page, so it waits for the server to confirm.
 */
function CheckoutWaiting() {
  const qc = useQueryClient();
  const [startedAt] = useState(() => Date.now());
  const [timedOut, setTimedOut] = useState(false);
  const { data } = useQuery({
    ...billingQuery,
    refetchInterval: (q) => (q.state.data?.plan === 'pro' || timedOut ? false : 2000),
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
            Unlimited projects, bigger teams and more AI are switched on. You can close the Razorpay
            tab.
          </p>
          <Button asChild className="mt-6">
            <Link to="/dashboard">Back to your projects</Link>
          </Button>
        </>
      ) : timedOut ? (
        <>
          <h1 className="font-display text-2xl font-semibold">Still waiting for Razorpay</h1>
          <p className="mt-2 text-ink-muted">
            We haven’t heard about a payment yet. If you paid, it usually shows up within a minute.
            Otherwise, go back and try again.
          </p>
          <Button asChild variant="secondary" className="mt-6">
            <Link to="/settings/billing">Check my plan</Link>
          </Button>
        </>
      ) : (
        <>
          <Loader2 className="size-10 animate-spin text-cobalt" aria-hidden />
          <h1 className="mt-4 font-display text-2xl font-semibold" role="status">
            Finish paying in the Razorpay tab
          </h1>
          <p className="mt-2 text-ink-muted">
            This page switches on Pro as soon as Razorpay confirms the payment.
          </p>
          <Button asChild variant="ghost" className="mt-6">
            <Link to="/pricing" search={{ checkout: undefined }}>
              Cancel and go back
            </Link>
          </Button>
        </>
      )}
    </div>
  );
}
