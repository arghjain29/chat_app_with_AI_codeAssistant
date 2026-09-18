import { PLANS } from '@codecollab/shared';
import { createFileRoute } from '@tanstack/react-router';
import { FolderPlus } from 'lucide-react';
import { useMe } from '@/features/auth/use-me';

export const Route = createFileRoute('/_app/dashboard')({
  component: Dashboard,
});

function Dashboard() {
  const { data: me, isPending, error } = useMe();

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <p role="alert" className="text-danger">
          Couldn’t load your account: {error.message}
        </p>
      </div>
    );
  }

  const plan = me ? PLANS[me.plan] : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {isPending ? (
              <span className="inline-block h-8 w-48 animate-pulse rounded bg-surface-2" />
            ) : (
              `Hi, ${me?.username}`
            )}
          </h1>
          {plan && <p className="mt-1 text-ink-muted">You’re on the {plan.name} plan.</p>}
        </div>
      </div>

      <section className="mt-10 grid place-items-center rounded-2xl border border-dashed border-line px-6 py-20 text-center">
        <FolderPlus className="size-10 text-ink-muted" aria-hidden />
        <h2 className="mt-4 font-display text-xl font-semibold">No projects yet</h2>
        <p className="mt-2 max-w-sm text-ink-muted">
          Projects hold your files, chat and AI history. Creating and sharing them is coming in the
          next update.
        </p>
      </section>
    </div>
  );
}
