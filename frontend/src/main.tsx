import { ClerkProvider, useAuth, useClerk } from '@clerk/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { createRouterAuth } from './features/auth/auth';
import { ApiError, setTokenGetter } from './lib/api';
import { env } from './lib/env';
import { routeTree } from './routeTree.gen';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retrying won't fix auth, permission or validation errors.
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
    },
  },
});

const { auth, sync: syncAuth } = createRouterAuth();

const router = createRouter({
  routeTree,
  context: { auth, queryClient },
  defaultPreload: 'intent',
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

/** Keeps the router and API client in step with Clerk, without blocking the first render. */
function AuthBridge() {
  const clerk = useClerk();
  const { isLoaded, isSignedIn, getToken } = useAuth();

  // Set during render, not in an effect: route guards and loaders run from the router's
  // own (child) effects, which fire before this component's effects would.
  syncAuth(clerk, isLoaded);
  setTokenGetter(() => getToken());

  const wasSignedIn = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (!isLoaded) return;
    if (wasSignedIn.current && !isSignedIn) {
      // Signed out (here or in another tab): drop the previous user's cached data
      // and leave any signed-in page.
      queryClient.clear();
      if (router.state.matches.some((m) => m.routeId.startsWith('/_app'))) {
        void router.navigate({ to: '/', replace: true });
      }
    }
    wasSignedIn.current = isSignedIn;
  }, [isLoaded, isSignedIn]);

  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={env.VITE_CLERK_PUBLISHABLE_KEY}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      afterSignOutUrl="/"
      // Clerk hands over complete URLs (path + query), so navigate by href.
      routerPush={(to) => router.navigate({ href: to })}
      routerReplace={(to) => router.navigate({ href: to, replace: true })}
      appearance={{
        variables: {
          colorPrimary: 'var(--cobalt)',
          colorBackground: 'var(--surface)',
          colorForeground: 'var(--ink)',
          colorMutedForeground: 'var(--ink-muted)',
          colorInput: 'var(--surface)',
          colorInputForeground: 'var(--ink)',
          colorBorder: 'var(--line)',
          fontFamily: 'var(--font-sans)',
          borderRadius: '0.5rem',
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <AuthBridge />
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ClerkProvider>
  </StrictMode>,
);
