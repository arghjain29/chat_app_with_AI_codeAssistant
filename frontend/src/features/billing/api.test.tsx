import type { BillingSummary } from '@codecollab/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({ env: { VITE_API_URL: 'http://api.test' } }));

const { billingQuery, useCheckPendingPayment } = await import('./api');

const summary = (over: Partial<BillingSummary> = {}): BillingSummary => ({
  plan: 'free',
  enabled: true,
  testMode: true,
  proUntil: null,
  interval: null,
  pending: { url: 'https://rzp.test/month/1', interval: 'month' },
  ...over,
});

/** Answer each call to POST /billing/check with the next summary in the list. */
function serve(...replies: BillingSummary[]) {
  const fetchMock = vi.fn(() => {
    const body = replies.length > 1 ? replies.shift()! : replies[0]!;
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('checking an unfinished payment', () => {
  it('asks the server and publishes the answer as the billing summary', async () => {
    const paid = summary({ plan: 'pro', proUntil: '2026-10-20T00:00:00.000Z', pending: null });
    const fetchMock = serve(paid);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useCheckPendingPayment(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current).toEqual(paid));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://api.test/api/v1/billing/check');
    expect((init as RequestInit).method).toBe('POST');
    // Every page reading billing now sees Pro, without fetching again.
    expect(client.getQueryData(billingQuery.queryKey)).toEqual(paid);
  });

  it('stays quiet until there is something to check', async () => {
    const fetchMock = serve(summary());
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    renderHook(() => useCheckPendingPayment({ enabled: false }), { wrapper: wrapper(client) });

    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps checking while a payment is pending, then stops once Pro is on', async () => {
    const paid = summary({ plan: 'pro', proUntil: '2026-10-20T00:00:00.000Z', pending: null });
    const fetchMock = serve(summary(), summary(), paid);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useCheckPendingPayment({ every: 10 }), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current?.plan).toBe('pro'));
    const callsWhenConfirmed = fetchMock.mock.calls.length;
    expect(callsWhenConfirmed).toBeGreaterThan(1); // It polled while the payment was pending.

    await new Promise((r) => setTimeout(r, 60));
    expect(fetchMock.mock.calls).toHaveLength(callsWhenConfirmed);
  });
});
