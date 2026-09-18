import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { projectQuery } from '@/features/projects/api';
import { DangerSection } from '@/features/projects/settings/danger-section';
import { GeneralSection } from '@/features/projects/settings/general-section';
import { InvitesSection } from '@/features/projects/settings/invites-section';
import { MembersSection } from '@/features/projects/settings/members-section';

export const Route = createFileRoute('/_app/projects/$projectId/settings')({
  component: Settings,
});

function Settings() {
  const { projectId } = Route.useParams();
  const { data: project } = useQuery(projectQuery(projectId));
  if (!project) return null; // The parent layout shows loading and error states.

  const isOwner = project.role === 'owner';
  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      {/* Keyed so the form resets if the project is renamed elsewhere. */}
      <GeneralSection key={`${project.name}|${project.description}`} project={project} />
      <MembersSection project={project} />
      {isOwner && <InvitesSection project={project} />}
      {isOwner && <DangerSection project={project} />}
    </div>
  );
}
