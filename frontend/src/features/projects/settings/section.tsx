import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** A settings block: title and explanation on the left, controls on the right (stacked on mobile). */
export function Section({
  title,
  description,
  children,
  tone,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
  tone?: 'danger';
}) {
  return (
    <section className="grid gap-6 border-b border-line py-8 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div>
        <h2
          className={cn('font-display text-lg font-semibold', tone === 'danger' && 'text-danger')}
        >
          {title}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
