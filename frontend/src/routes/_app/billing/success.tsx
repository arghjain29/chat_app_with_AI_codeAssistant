import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { meQuery } from '@/features/auth/use-me';
import { useCheckPendingPayment } from '@/features/billing/api';
import { usageQuery } from '@/features/chat/chat-api';

export const Route = createFileRoute('/_app/billing/success')({
  component: CheckoutWaiting,
});

// Razorpay usually confirms within seconds, but allow for a slow settlement.
const GIVE_UP_AFTER_MS = 5 * 60_000;
const CHECK_EVERY_MS = 3000;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

/**
 * Where Razorpay sends people after paying. This page never grants anything: it asks the server
 * to check the payment with Razorpay, and the payment is done once Pro is on with nothing left
 * pending.
 */
function CheckoutWaiting() {
  const qc = useQueryClient();
  const [startedAt] = useState(() => Date.now());
  const [timedOut, setTimedOut] = useState(false);
  const data = useCheckPendingPayment({ every: timedOut ? false : CHECK_EVERY_MS });
  const confirmed = !!data && data.plan === 'pro' && !data.pending;

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
            Unlimited projects, bigger teams and more AI are switched on
            {data.proUntil ? ` until ${formatDate(data.proUntil)}` : ''}. Nothing renews by itself.
          </p>
          <Button asChild className="mt-6">
            <Link to="/dashboard">Back to your projects</Link>
          </Button>
        </>
      ) : timedOut ? (
        <>
          <h1 className="font-display text-2xl font-semibold">Still waiting for Razorpay</h1>
          <p className="mt-2 text-ink-muted">
            Razorpay hasn’t confirmed a payment yet. If you paid, it usually lands within a minute
            and your plan updates by itself. Otherwise, go back and try again.
          </p>
          <Button asChild variant="secondary" className="mt-6">
            <Link to="/settings/billing">Check my plan</Link>
          </Button>
        </>
      ) : (
        <>
          <Loader2 className="size-10 animate-spin text-cobalt" aria-hidden />
          <h1 className="mt-4 font-display text-2xl font-semibold" role="status">
            Confirming your payment
          </h1>
          <p className="mt-2 text-ink-muted">
            This takes a few seconds. Pro switches on as soon as Razorpay confirms it.
          </p>
          <Button asChild variant="ghost" className="mt-6">
            <Link to="/settings/billing">Go to billing settings</Link>
          </Button>
        </>
      )}
    </div>
  );
}
