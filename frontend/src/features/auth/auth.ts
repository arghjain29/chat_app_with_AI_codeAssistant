import type { useClerk } from '@clerk/react';

type ClerkInstance = ReturnType<typeof useClerk>;

/**
 * Auth as seen by route guards.
 *
 * Guards must read Clerk's *live* session: right after sign-in, Clerk navigates to the
 * app before React has re-rendered with the new auth state, so a snapshot taken during
 * render would still say "signed out" and bounce the user back to the sign-in page.
 */
export interface RouterAuth {
  /** Resolves once Clerk has loaded and knows whether there is a session. */
  ready(): Promise<void>;
  isSignedIn(): boolean;
}

export function createRouterAuth() {
  let clerk: ClerkInstance | null = null;
  let markLoaded!: () => void;
  const loaded = new Promise<void>((resolve) => (markLoaded = resolve));

  const auth: RouterAuth = {
    ready: () => loaded,
    isSignedIn: () => !!clerk?.isSignedIn,
  };

  /** Called from React on every render with the current Clerk instance. */
  const sync = (instance: ClerkInstance, isLoaded: boolean) => {
    clerk = instance;
    if (isLoaded) markLoaded();
  };

  return { auth, sync };
}

/**
 * Only follow same-site relative paths from `redirect_url`, so a crafted link
 * can't bounce people to another site after they sign in.
 */
export const safeRedirect = (url: unknown, fallback = '/dashboard') =>
  typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : fallback;
