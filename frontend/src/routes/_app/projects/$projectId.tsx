import { UserButton } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { projectQuery } from '@/features/projects/api';
import { ProjectMonogram } from '@/features/projects/project-monogram';
import { ApiError } from '@/lib/api';
import { ROLE_LABEL } from '@/lib/format';

export const Route = createFileRoute('/_app/projects/$projectId')({
  loader: ({ context, params }) =>
    context.queryClient.prefetchQuery(projectQuery(params.projectId)),
  component: ProjectLayout,
});

const TABS = [
  ['/projects/$projectId', 'Workspace'],
  ['/projects/$projectId/settings', 'Settings'],
] as const;

function ProjectLayout() {
  const { projectId } = Route.useParams();
  const { data: project, error } = useQuery(projectQuery(projectId));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* One compact bar for project pages: where you are, where you can go, who you are. */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface px-3 lg:px-4">
        <Logo to="/dashboard" markOnly className="[&_img]:size-6" />
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
          <Link to="/dashboard" className="hidden text-ink-muted hover:text-ink sm:inline">
            Projects
          </Link>
          <span className="hidden text-line sm:inline" aria-hidden>
            /
          </span>
          {project ? (
            <span className="flex min-w-0 items-center gap-2">
              <ProjectMonogram project={project} size="xs" />
              <span className="truncate font-medium" aria-current="page">
                {project.name}
              </span>
              {project.role !== 'owner' && (
                <span className="shrink-0 rounded-full border border-line px-1.5 text-[11px] text-ink-muted">
                  {ROLE_LABEL[project.role]}
                </span>
              )}
            </span>
          ) : (
            !error && <span className="h-4 w-32 animate-pulse rounded bg-surface-2" />
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {!error && (
            <nav
              aria-label="Project"
              className="flex rounded-lg border border-line bg-paper p-0.5 text-[13px]"
            >
              {TABS.map(([to, label]) => (
                <Link
                  key={to}
                  to={to}
                  params={{ projectId }}
                  activeOptions={{ exact: true }}
                  className="rounded-md px-2.5 py-1 text-ink-muted hover:text-ink"
                  activeProps={{ className: 'bg-surface text-ink! font-medium shadow-sm' }}
                >
                  {label}
                </Link>
              ))}
            </nav>
          )}
          <ThemeToggle />
          <UserButton />
        </div>
      </header>

      {error ? <ProjectError error={error} /> : <Outlet />}
    </div>
  );
}

function ProjectError({ error }: { error: Error }) {
  const missing = error instanceof ApiError && error.status === 404;
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="font-display text-2xl font-semibold">
        {missing ? 'Project not found' : 'Couldn’t open this project'}
      </h1>
      <p className="mt-2 text-ink-muted">
        {missing
          ? 'It may have been deleted, or you’re no longer a member. Ask the owner for a new invite link.'
          : error.message}
      </p>
      <Button asChild className="mt-6">
        <Link to="/dashboard">Back to projects</Link>
      </Button>
    </div>
  );
}
