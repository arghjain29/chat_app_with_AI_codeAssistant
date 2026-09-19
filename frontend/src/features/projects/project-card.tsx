import type { Project } from '@codecollab/shared';
import { Link } from '@tanstack/react-router';
import { Avatar } from '@/components/ui/avatar';
import { relativeTime, ROLE_LABEL } from '@/lib/format';
import { ProjectMonogram } from './project-monogram';

export function ProjectCard({ project }: { project: Project }) {
  const others = project.memberCount - project.members.length;

  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: project.id }}
      className="group flex min-h-48 flex-col rounded-xl border border-line bg-surface p-5 transition-colors hover:border-ink-muted/50 focus-visible:border-cobalt"
    >
      <div className="flex items-start gap-3">
        <ProjectMonogram project={project} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-[17px] leading-tight font-semibold">
            {project.name}
          </h3>
          <p className="mt-0.5 truncate text-xs text-ink-muted">
            {project.role === 'owner'
              ? 'Owned by you'
              : `${ROLE_LABEL[project.role]} in ${project.owner.username}’s project`}
          </p>
        </div>
        {project.unreadCount > 0 && (
          <span
            className="shrink-0 rounded-full bg-cobalt px-2 py-0.5 text-[11px] font-semibold text-cobalt-ink tabular-nums"
            title={`${project.unreadCount} unread ${project.unreadCount === 1 ? 'message' : 'messages'}`}
          >
            {project.unreadCount > 99 ? '99+' : project.unreadCount}
            <span className="sr-only"> unread messages</span>
          </span>
        )}
      </div>

      <p
        className={
          project.description
            ? 'mt-4 line-clamp-2 text-sm text-ink-muted'
            : 'mt-4 text-sm text-ink-muted/60 italic'
        }
      >
        {project.description || 'No description'}
      </p>

      <div className="mt-auto flex items-center justify-between border-t border-line/70 pt-4 text-xs text-ink-muted">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {project.members.map((m) => (
              <Avatar key={m.id} user={m} size="sm" className="ring-2 ring-surface" />
            ))}
          </div>
          <span>
            {project.memberCount === 1
              ? 'Just you'
              : others > 0
                ? `+${others} more`
                : `${project.memberCount} people`}
          </span>
        </div>
        <span title={new Date(project.updatedAt).toLocaleString()}>
          Edited {relativeTime(project.updatedAt)}
        </span>
      </div>
    </Link>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="flex min-h-48 flex-col rounded-xl border border-line bg-surface p-5">
      <div className="flex gap-3">
        <span className="size-10 animate-pulse rounded-lg bg-surface-2" />
        <div className="flex-1 space-y-2 pt-1">
          <span className="block h-4 w-2/3 animate-pulse rounded bg-surface-2" />
          <span className="block h-3 w-1/3 animate-pulse rounded bg-surface-2" />
        </div>
      </div>
      <span className="mt-5 block h-3 w-full animate-pulse rounded bg-surface-2" />
      <span className="mt-2 block h-3 w-4/5 animate-pulse rounded bg-surface-2" />
    </div>
  );
}
