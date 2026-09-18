import type { Project } from '@codecollab/shared';
import { Link } from '@tanstack/react-router';
import { Users } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { relativeTime, ROLE_LABEL } from '@/lib/format';

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: project.id }}
      className="group flex min-h-40 flex-col rounded-xl border border-line bg-surface p-5 transition-colors hover:border-cobalt/60"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg leading-snug font-semibold group-hover:text-cobalt">
          {project.name}
        </h3>
        {project.role !== 'owner' && (
          <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs text-ink-muted">
            {ROLE_LABEL[project.role]}
          </span>
        )}
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm text-ink-muted">
        {project.description || 'No description'}
      </p>
      <div className="mt-auto flex items-center justify-between pt-5 text-xs text-ink-muted">
        <span className="flex items-center gap-2">
          <Avatar user={project.owner} size="sm" />
          {project.role === 'owner' ? 'You' : project.owner.username}
        </span>
        <span className="flex items-center gap-3">
          {project.unreadCount > 0 && (
            <span className="rounded-full bg-cobalt px-2 py-0.5 font-medium text-cobalt-ink">
              {project.unreadCount > 99 ? '99+' : project.unreadCount} new{' '}
              {project.unreadCount === 1 ? 'message' : 'messages'}
            </span>
          )}
          <span className="flex items-center gap-1" title={`${project.memberCount} people`}>
            <Users className="size-3.5" aria-hidden />
            {project.memberCount}
          </span>
          <span>Updated {relativeTime(project.updatedAt)}</span>
        </span>
      </div>
    </Link>
  );
}
