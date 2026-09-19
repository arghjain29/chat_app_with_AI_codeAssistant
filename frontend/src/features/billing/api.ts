import type { BillingInterval, BillingSummary, Redirect } from '@codecollab/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { toastError } from '../projects/api';

export const billingQuery = queryOptions({
  queryKey: ['me', 'billing'],
  queryFn: () => api<BillingSummary>('/billing'),
});

/**
 * Open Razorpay's payment page in a new tab, and move this tab to the confirmation page,
 * which updates by itself once Razorpay confirms the payment.
 */
export function useCheckout() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (interval: BillingInterval) => {
      // Open the tab now, while the click still counts as a user action, so pop-up blockers
      // allow it; point it at the payment page once the server has created it.
      const tab = window.open('about:blank', '_blank');
      try {
        const { url } = await api<Redirect>('/billing/checkout', {
          method: 'POST',
          body: JSON.stringify({ interval }),
        });
        return { url, tab };
      } catch (err) {
        tab?.close();
        throw err;
      }
    },
    onSuccess: ({ url, tab }) => {
      if (tab && !tab.closed) {
        tab.location.href = url;
        void navigate({ to: '/billing/success' });
      } else {
        window.location.assign(url); // Pop-up blocked: pay in this tab instead.
      }
    },
    onError: toastError,
  });
}

/** Stop renewing; Pro stays until the end of the paid period. */
export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<BillingSummary>('/billing/cancel', { method: 'POST' }),
    onSuccess: (summary) => {
      qc.setQueryData(billingQuery.queryKey, summary);
      toast.success('Subscription cancelled. Pro stays on until the end of this period.');
    },
    onError: toastError,
  });
}
