import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import type { HocuspocusProviderConfiguration } from '@hocuspocus/provider';
import { getAuthToken } from './api';
import { env } from './env';

export const COLLAB_URL = `${env.VITE_API_URL.replace(/^http/, 'ws')}/collab`;

let socket: HocuspocusProviderWebsocket | null = null;

/** One WebSocket for the whole app; every open document is multiplexed over it. */
function sharedSocket() {
  if (socket) return socket;
  const ws = new HocuspocusProviderWebsocket({
    url: COLLAB_URL,
    // Retry quickly: the default backoff grows to 30s, which feels like the app is broken
    // (e.g. after the API restarts). Capped at 5s, with jitter so clients don't stampede.
    delay: 500,
    minDelay: 500,
    maxDelay: 5_000,
  });
  // Coming back online or to the tab: reconnect now instead of waiting for the next retry.
  const reconnectNow = () => {
    if (document.visibilityState === 'visible' && ws.status === 'disconnected') void ws.connect();
  };
  window.addEventListener('online', reconnectNow);
  document.addEventListener('visibilitychange', reconnectNow);
  socket = ws;
  return ws;
}

/** Open a real-time document. Call `destroy()` on the result when done with it. */
export function openDocument(
  name: string,
  options: Partial<Omit<HocuspocusProviderConfiguration, 'name' | 'websocketProvider'>> = {},
) {
  const provider = new HocuspocusProvider({
    ...options,
    name,
    websocketProvider: sharedSocket(),
    // Each open copy of a document gets its own session on the shared socket. Without this,
    // closing and immediately reopening a document (React does exactly that in development)
    // lets the old copy's "close" cancel the new one: it looks connected but never syncs.
    sessionAwareness: true,
    // A fresh short-lived Clerk token every time the connection (re)authenticates.
    token: async () => (await getAuthToken()) ?? '',
  });
  provider.attach();
  return provider;
}
