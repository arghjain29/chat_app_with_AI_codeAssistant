import { UserButton } from '@clerk/react';
import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';

/** Layout for every signed-in page. Anonymous visitors are sent to sign in. */
export const Route = createFileRoute('/_app')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isSignedIn) {
      throw redirect({
        to: '/sign-in/$',
        params: { _splat: '' },
        search: { redirect_url: location.href },
      });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Logo />
            <nav className="hidden gap-4 text-sm text-ink-muted sm:flex">
              <Link
                to="/dashboard"
                className="hover:text-ink"
                activeProps={{ className: 'text-ink font-medium' }}
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
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
