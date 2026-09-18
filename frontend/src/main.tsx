import { ClerkProvider, useAuth } from '@clerk/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
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

const router = createRouter({
  routeTree,
  context: { auth: { isSignedIn: false }, queryClient },
  defaultPreload: 'intent',
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

function App() {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  // Set during render, not in an effect: route loaders fire from the router's own
  // (child) effects, which run before this component's effects would.
  setTokenGetter(() => getToken());

  // Re-run route guards whenever the session changes (sign in / sign out).
  useEffect(() => {
    if (isLoaded) void router.invalidate();
  }, [isLoaded, isSignedIn]);

  if (!isLoaded) return <div className="min-h-dvh bg-paper" aria-busy="true" />;

  return <RouterProvider router={router} context={{ auth: { isSignedIn: !!isSignedIn } }} />;
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
      routerPush={(to) => router.navigate({ to })}
      routerReplace={(to) => router.navigate({ to, replace: true })}
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
        <App />
      </QueryClientProvider>
    </ClerkProvider>
  </StrictMode>,
);
