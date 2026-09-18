import { PLANS } from '@codecollab/shared';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { FolderPlus, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { meQuery, useMe } from '@/features/auth/use-me';
import { projectsQuery } from '@/features/projects/api';
import { CreateProjectDialog } from '@/features/projects/create-project-dialog';
import { ProjectCard } from '@/features/projects/project-card';

export const Route = createFileRoute('/_app/dashboard')({
  // Fetch both in parallel rather than waiting for one before starting the other.
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.prefetchQuery(projectsQuery),
      context.queryClient.prefetchQuery(meQuery),
    ]),
  component: Dashboard,
});

function Dashboard() {
  const { data: me } = useMe();
  const { data: projects, isPending, error, refetch } = useQuery(projectsQuery);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !projects) return projects;
    return projects.filter(
      (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
    );
  }, [projects, search]);

  const owned = projects?.filter((p) => p.role === 'owner').length ?? 0;
  const limit = me ? PLANS[me.plan].limits.maxOwnedProjects : null;
  const atLimit = limit !== null && owned >= limit;

  const newButton = (
    <Button disabled={atLimit}>
      <Plus /> New project
    </Button>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Projects</h1>
          {me && limit !== null && (
            <p className="mt-1 text-sm text-ink-muted">
              {atLimit
                ? `You’ve used all ${limit} projects on the Free plan. Delete one or upgrade to Pro for unlimited projects.`
                : `You own ${owned} of ${limit} projects on the Free plan.`}
            </p>
          )}
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          {projects && projects.length > 3 && (
            <div className="relative flex-1 sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects"
                aria-label="Search projects"
                className="pl-9"
              />
            </div>
          )}
          {atLimit ? newButton : <CreateProjectDialog trigger={newButton} />}
        </div>
      </div>

      <div className="mt-8">
        {error ? (
          <div role="alert" className="rounded-xl border border-danger/40 bg-danger/5 p-6">
            <p className="font-medium">Couldn’t load your projects.</p>
            <p className="mt-1 text-sm text-ink-muted">{error.message}</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl bg-surface-2" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState />
        ) : filtered?.length === 0 ? (
          <p className="py-16 text-center text-ink-muted">No projects match “{search}”.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered?.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <section className="grid place-items-center rounded-2xl border border-dashed border-line px-6 py-20 text-center">
      <FolderPlus className="size-10 text-ink-muted" aria-hidden />
      <h2 className="mt-4 font-display text-xl font-semibold">Start your first project</h2>
      <p className="mt-2 max-w-sm text-ink-muted">
        A project holds your code, team chat and AI history. Create one, then share an invite link
        with your team.
      </p>
      <CreateProjectDialog
        trigger={
          <Button className="mt-6">
            <Plus /> New project
          </Button>
        }
      />
    </section>
  );
}
