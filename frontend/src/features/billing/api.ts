import type { BillingInterval, BillingSummary, Redirect } from '@codecollab/shared';
import { queryOptions, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toastError } from '../projects/api';

export const billingQuery = queryOptions({
  queryKey: ['me', 'billing'],
  queryFn: () => api<BillingSummary>('/billing'),
});

/** Send the browser to Stripe's hosted checkout. */
export function useCheckout() {
  return useMutation({
    mutationFn: (interval: BillingInterval) =>
      api<Redirect>('/billing/checkout', { method: 'POST', body: JSON.stringify({ interval }) }),
    onSuccess: ({ url }) => window.location.assign(url),
    onError: toastError,
  });
}

/** Send the browser to Stripe's customer portal (card, invoices, cancel). */
export function usePortal() {
  return useMutation({
    mutationFn: () => api<Redirect>('/billing/portal', { method: 'POST' }),
    onSuccess: ({ url }) => window.location.assign(url),
    onError: toastError,
  });
}
