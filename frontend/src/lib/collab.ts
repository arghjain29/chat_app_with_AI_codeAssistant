import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import type { HocuspocusProviderConfiguration } from '@hocuspocus/provider';
import { getAuthToken } from './api';
import { env } from './env';

export const COLLAB_URL = `${env.VITE_API_URL.replace(/^http/, 'ws')}/collab`;

let socket: HocuspocusProviderWebsocket | null = null;

/** One WebSocket for the whole app; every open document is multiplexed over it. */
function sharedSocket() {
  socket ??= new HocuspocusProviderWebsocket({ url: COLLAB_URL });
  return socket;
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
    // A fresh short-lived Clerk token every time the connection (re)authenticates.
    token: async () => (await getAuthToken()) ?? '',
  });
  provider.attach();
  return provider;
}
