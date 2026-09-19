import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/utils';

/** The CodeCollab mark and name. Signed-in pages link it to the dashboard. */
export function Logo({
  to = '/',
  markOnly = false,
  className,
}: {
  to?: '/' | '/dashboard';
  markOnly?: boolean;
  className?: string;
}) {
  return (
    <Link
      to={to}
      aria-label={markOnly ? 'CodeCollab: all projects' : undefined}
      className={cn(
        'flex shrink-0 items-center gap-2 font-display text-lg font-semibold tracking-tight',
        className,
      )}
    >
      {/* The ring keeps the navy mark visible on the dark theme's navy background. */}
      <img src="/favicon.svg" alt="" className="size-7 rounded-lg dark:ring-1 dark:ring-line" />
      {!markOnly && 'CodeCollab'}
    </Link>
  );
}
