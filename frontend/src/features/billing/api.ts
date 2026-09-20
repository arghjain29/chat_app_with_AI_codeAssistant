import type { BillingInterval, BillingSummary, Redirect } from '@codecollab/shared';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '@/lib/api';
import { toastError } from '../projects/api';

export const billingQuery = queryOptions({
  queryKey: ['me', 'billing'],
  queryFn: () => api<BillingSummary>('/billing'),
});

/**
 * Buy one period of Pro. This tab moves to Razorpay's payment page, which sends the person
 * back to /billing/success afterwards; the plan itself changes server-side.
 */
export function useCheckout() {
  return useMutation({
    mutationFn: (interval: BillingInterval) =>
      api<Redirect>('/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ interval }),
      }),
    onSuccess: ({ url }) => window.location.assign(url),
    onError: toastError,
  });
}

/**
 * Have the server re-check an unfinished payment with Razorpay, rather than waiting for the
 * webhook. Whatever comes back becomes the billing summary everywhere.
 */
export function useCheckPendingPayment({
  enabled = true,
  every,
}: {
  enabled?: boolean;
  /** Keep checking this often until the payment lands. Left out, it is checked once. */
  every?: number | false;
} = {}) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['me', 'billing', 'check'],
    queryFn: () => api<BillingSummary>('/billing/check', { method: 'POST' }),
    enabled,
    refetchInterval: (q) => {
      const d = q.state.data;
      // Nothing more to wait for once Pro is on with nothing pending.
      return !every || (d && d.plan === 'pro' && !d.pending) ? false : every;
    },
    gcTime: 0,
  });

  const summary = query.data;
  useEffect(() => {
    if (summary) qc.setQueryData(billingQuery.queryKey, summary);
  }, [summary, qc]);

  return summary;
}
