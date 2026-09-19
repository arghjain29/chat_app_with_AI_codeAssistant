import { UserButton } from '@clerk/react';
import { createFileRoute, Link, Outlet, redirect, useMatchRoute } from '@tanstack/react-router';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';

/** Layout for every signed-in page. Anonymous visitors are sent to sign in. */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    await context.auth.ready();
    if (!context.auth.isSignedIn()) {
      throw redirect({
        to: '/sign-in/$',
        params: { _splat: '' },
        search: { redirect_url: location.href },
      });
    }
  },
  component: AppLayout,
  // Shown only if Clerk takes a moment to load on a direct visit to a signed-in page.
  pendingComponent: () => <div className="min-h-dvh bg-paper" aria-busy="true" />,
});

function AppLayout() {
  const matchRoute = useMatchRoute();
  // Project pages bring their own, more compact bar.
  const inProject = !!matchRoute({ to: '/projects/$projectId', fuzzy: true });

  return (
    // Pages that hold the workspace get exactly one screen of height, so panels scroll inside.
    <div className="flex min-h-dvh flex-col has-[[data-workspace]]:h-dvh">
      {!inProject && (
        <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
          <div className="flex h-14 items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-6">
              <Logo to="/dashboard" />
              <nav className="hidden text-sm sm:flex" aria-label="Main">
                <Link
                  to="/dashboard"
                  className="rounded-md px-2.5 py-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink"
                  activeProps={{ className: 'bg-surface-2 text-ink! font-medium' }}
                >
                  Projects
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <UserButton />
            </div>
          </div>
        </header>
      )}
      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
