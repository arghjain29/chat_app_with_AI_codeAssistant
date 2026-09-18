import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  Link,
  Outlet,
  type ErrorComponentProps,
} from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { Button } from '@/components/ui/button';
import type { RouterAuth } from '@/features/auth/auth';
import { useTheme } from '@/lib/theme';

export interface RouterContext {
  auth: RouterAuth;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: Root,
  notFoundComponent: NotFound,
  errorComponent: RouteError,
});

function Root() {
  const { theme } = useTheme();
  return (
    <>
      <Outlet />
      <Toaster theme={theme} position="bottom-right" richColors closeButton />
    </>
  );
}

function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-sm text-center">
        <p className="font-display text-7xl font-bold text-ink-muted/40">404</p>
        <h1 className="mt-4 font-display text-2xl font-semibold">This page doesn’t exist</h1>
        <p className="mt-2 text-ink-muted">
          The link may be old, or the project was deleted or moved.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Go to the home page</Link>
        </Button>
      </div>
    </main>
  );
}

function RouteError({ error, reset }: ErrorComponentProps) {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl font-semibold">Something broke on this page</h1>
        <p className="mt-2 text-ink-muted">
          {error instanceof Error ? error.message : 'An unexpected error occurred.'}
        </p>
        <Button className="mt-6" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}
