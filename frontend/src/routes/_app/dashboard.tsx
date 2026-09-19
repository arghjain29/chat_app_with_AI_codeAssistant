import { PLANS, type Project } from '@codecollab/shared';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { meQuery, useMe } from '@/features/auth/use-me';
import { usageQuery } from '@/features/chat/chat-api';
import { projectsQuery } from '@/features/projects/api';
import { CreateProjectDialog } from '@/features/projects/create-project-dialog';
import { ProjectCard, ProjectCardSkeleton } from '@/features/projects/project-card';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_app/dashboard')({
  // Fetch both in parallel rather than waiting for one before starting the other.
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.prefetchQuery(projectsQuery),
      context.queryClient.prefetchQuery(meQuery),
    ]),
  component: Dashboard,
});

type Filter = 'all' | 'mine' | 'shared';

const FILTERS: { id: Filter; label: string; match: (p: Project) => boolean }[] = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'mine', label: 'Yours', match: (p) => p.role === 'owner' },
  { id: 'shared', label: 'Shared with you', match: (p) => p.role !== 'owner' },
];

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

function Dashboard() {
  const { data: me } = useMe();
  const { data: projects, isPending, error, refetch } = useQuery(projectsQuery);
  const { data: usage } = useQuery(usageQuery);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const owned = projects?.filter((p) => p.role === 'owner').length ?? 0;
  const plan = me ? PLANS[me.plan] : null;
  const limit = plan?.limits.maxOwnedProjects ?? null;
  const atLimit = limit !== null && owned >= limit;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = FILTERS.find((f) => f.id === filter)!.match;
    return (projects ?? []).filter(
      (p) =>
        match(p) &&
        (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)),
    );
  }, [projects, filter, search]);

  const newButton = (
    <Button disabled={atLimit}>
      <Plus /> New project
    </Button>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-10 pb-16 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm text-ink-muted">{me ? `${greeting()}, ${me.username}.` : ' '}</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Projects</h1>
        </div>
        <div className="flex items-center gap-5">
          <div className="hidden gap-2 sm:grid">
            {limit !== null && plan && (
              <PlanMeter label={`${plan.name} plan`} used={owned} limit={limit} unit="projects" />
            )}
            {me?.plan === 'free' && (
              <Link
                to="/pricing"
                search={{ checkout: undefined }}
                className="order-last text-right text-xs font-medium text-cobalt hover:underline"
              >
                Upgrade to Pro
              </Link>
            )}
            {usage?.aiAvailable && (
              <PlanMeter
                label="AI requests"
                used={usage.aiRequests.used}
                limit={usage.aiRequests.limit}
                unit={usage.aiRequests.period === 'day' ? 'today' : 'this month'}
              />
            )}
          </div>
          {atLimit ? newButton : <CreateProjectDialog trigger={newButton} />}
        </div>
      </header>

      {error ? (
        <div role="alert" className="mt-10 rounded-xl border border-danger/40 bg-danger/5 p-6">
          <p className="font-medium">Couldn’t load your projects.</p>
          <p className="mt-1 text-sm text-ink-muted">{error.message}</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : !isPending && projects.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-b border-line">
            <div className="flex gap-1" role="tablist" aria-label="Filter projects">
              {FILTERS.map((f) => {
                const count = projects?.filter(f.match).length;
                return (
                  <button
                    key={f.id}
                    role="tab"
                    aria-selected={filter === f.id}
                    onClick={() => setFilter(f.id)}
                    className={cn(
                      '-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 pb-2.5 text-sm whitespace-nowrap',
                      filter === f.id
                        ? 'border-ink font-medium text-ink'
                        : 'border-transparent text-ink-muted hover:text-ink',
                    )}
                  >
                    {f.label}
                    {count !== undefined && (
                      <span className="rounded-full bg-surface-2 px-1.5 text-[11px] tabular-nums">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="relative mb-2 w-full sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find a project"
                aria-label="Find a project"
                className="h-9 pl-9"
              />
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy={isPending}>
            {isPending ? (
              Array.from({ length: 3 }, (_, i) => <ProjectCardSkeleton key={i} />)
            ) : visible.length === 0 ? (
              <p className="col-span-full py-16 text-center text-sm text-ink-muted">
                {search
                  ? `No projects match “${search}”.`
                  : filter === 'shared'
                    ? 'Nobody has shared a project with you yet. Invite links from teammates land here.'
                    : 'Nothing here yet.'}
              </p>
            ) : (
              <>
                {visible.map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
                {filter !== 'shared' && !search && !atLimit && (
                  <CreateProjectDialog
                    trigger={
                      <button className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line text-sm text-ink-muted transition-colors hover:border-cobalt hover:text-cobalt">
                        <Plus className="size-5" />
                        New project
                      </button>
                    }
                  />
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** How much of the plan's project allowance is used. */
function PlanMeter({
  label,
  used,
  limit,
  unit,
}: {
  label: string;
  used: number;
  limit: number;
  unit: string;
}) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const full = used >= limit;
  return (
    <div className="w-52">
      <div className="flex justify-between gap-2 text-xs">
        <span className="text-ink-muted">{label}</span>
        <span className={cn('tabular-nums', full ? 'font-medium text-danger' : 'text-ink')}>
          {used} of {limit} {unit}
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2"
        role="meter"
        aria-label={`${label} used`}
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
      >
        <div
          className={cn('h-full rounded-full', full ? 'bg-danger' : 'bg-cobalt')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const STEPS = [
  ['Create a project', 'Start from a runnable web page, or an empty project in any language.'],
  ['Invite your team', 'Share a link. Choose whether people can edit or only view.'],
  ['Build together', 'Edit the same files live, chat beside the code, and run it in the browser.'],
] as const;

function EmptyState() {
  return (
    <section className="mt-12 grid gap-10 rounded-2xl border border-line bg-surface p-8 md:grid-cols-[1fr_1.2fr] md:p-12">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Your first project is a minute away
        </h2>
        <p className="mt-3 max-w-sm text-ink-muted">
          A project holds your code, your team’s chat and everything you run. Start one, then bring
          people in.
        </p>
        <CreateProjectDialog
          trigger={
            <Button size="lg" className="mt-6">
              <Plus /> Create a project
            </Button>
          }
        />
      </div>
      <ol className="grid gap-5">
        {STEPS.map(([title, body], i) => (
          <li key={title} className="flex gap-4">
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line font-display text-sm font-semibold">
              {i + 1}
            </span>
            <div>
              <p className="font-medium">{title}</p>
              <p className="mt-0.5 text-sm text-ink-muted">{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
