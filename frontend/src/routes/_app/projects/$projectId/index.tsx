import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useMe } from '@/features/auth/use-me';
import { projectQuery } from '@/features/projects/api';
import { filesQuery } from '@/features/workspace/files-api';
import { Workspace } from '@/features/workspace/workspace';

export const Route = createFileRoute('/_app/projects/$projectId/')({
  loader: ({ context, params }) => context.queryClient.prefetchQuery(filesQuery(params.projectId)),
  component: WorkspaceRoute,
});

function WorkspaceRoute() {
  const { projectId } = Route.useParams();
  const { data: project } = useQuery(projectQuery(projectId));
  const { data: me } = useMe();
  // The parent layout shows loading and error states for the project.
  if (!project || !me) return <div className="flex-1 animate-pulse bg-surface" />;
  return <Workspace key={project.id} project={project} me={me} />;
}
