import { createFileRoute, Link } from '@tanstack/react-router';
import { Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/_app/projects/$projectId/')({
  component: Workspace,
});

/** Replaced by the collaborative editor in the next phase. */
function Workspace() {
  const { projectId } = Route.useParams();
  return (
    <div className="mx-auto grid max-w-md place-items-center px-4 py-24 text-center">
      <Code2 className="size-10 text-ink-muted" aria-hidden />
      <h2 className="mt-4 font-display text-xl font-semibold">The editor is on its way</h2>
      <p className="mt-2 text-ink-muted">
        Shared files, live cursors and in-browser previews come in the next update. For now you can
        invite your team from settings.
      </p>
      <Button asChild variant="secondary" className="mt-6">
        <Link to="/projects/$projectId/settings" params={{ projectId }}>
          Open settings
        </Link>
      </Button>
    </div>
  );
}
