import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { projectQuery } from '@/features/projects/api';
import { ApiError } from '@/lib/api';
import { ROLE_LABEL } from '@/lib/format';

export const Route = createFileRoute('/_app/projects/$projectId')({
  loader: ({ context, params }) =>
    context.queryClient.prefetchQuery(projectQuery(params.projectId)),
  component: ProjectLayout,
});

function ProjectLayout() {
  const { projectId } = Route.useParams();
  const { data: project, error, isPending } = useQuery(projectQuery(projectId));

  if (error) {
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 pt-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/dashboard"
              className="rounded-md p-1 text-ink-muted hover:bg-surface-2 hover:text-ink"
              aria-label="Back to projects"
            >
              <ArrowLeft className="size-4" />
            </Link>
            {isPending ? (
              <span className="h-6 w-40 animate-pulse rounded bg-surface-2" />
            ) : (
              <h1 className="truncate font-display text-xl font-semibold">{project.name}</h1>
            )}
            {project && project.role !== 'owner' && (
              <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-muted">
                {ROLE_LABEL[project.role]}
              </span>
            )}
          </div>
          <nav className="flex gap-1 text-sm" aria-label="Project">
            {(
              [
                ['/projects/$projectId', 'Workspace'],
                ['/projects/$projectId/settings', 'Settings'],
              ] as const
            ).map(([to, label]) => (
              <Link
                key={to}
                to={to}
                params={{ projectId }}
                activeOptions={{ exact: true }}
                className="border-b-2 border-transparent px-3 py-3 text-ink-muted hover:text-ink"
                activeProps={{ className: 'border-cobalt! text-ink font-medium' }}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
