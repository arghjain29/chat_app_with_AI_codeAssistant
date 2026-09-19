import type { Project } from '@codecollab/shared';
import { presenceClass } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

/** Two letters that identify a project at a glance: "Checkout redesign" -> "CR". */
const initials = (name: string) => {
  const words = name
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean);
  const letters =
    words.length > 1 ? `${words[0]![0]}${words[1]![0]}` : (words[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
};

const SIZES = {
  xs: 'size-5 rounded text-[9px]',
  md: 'size-10 rounded-lg text-sm',
} as const;

export function ProjectMonogram({
  project,
  size = 'md',
}: {
  project: Pick<Project, 'id' | 'name'>;
  size?: keyof typeof SIZES;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center font-display font-bold tracking-tight',
        SIZES[size],
        presenceClass(project.id),
      )}
    >
      {initials(project.name)}
    </span>
  );
}
