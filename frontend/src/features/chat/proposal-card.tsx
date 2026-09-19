import type { AiChange, AiProposal } from '@codecollab/shared';
import { diffLines } from 'diff';
import { Check, ChevronRight, FileMinus, FilePen, FilePlus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Line = { kind: 'add' | 'del' | 'same' | 'gap'; text: string };

/** Line diff with long unchanged stretches collapsed, like a code review. */
function useDiff(change: AiChange): { lines: Line[]; added: number; removed: number } {
  return useMemo(() => {
    const parts = diffLines(
      change.before ?? '',
      change.action === 'delete' ? '' : (change.content ?? ''),
    );
    const lines: Line[] = [];
    let added = 0;
    let removed = 0;
    for (const part of parts) {
      const rows = part.value.replace(/\n$/, '').split('\n');
      if (part.added) {
        added += rows.length;
        rows.forEach((text) => lines.push({ kind: 'add', text }));
      } else if (part.removed) {
        removed += rows.length;
        rows.forEach((text) => lines.push({ kind: 'del', text }));
      } else if (rows.length > 6) {
        rows.slice(0, 2).forEach((text) => lines.push({ kind: 'same', text }));
        lines.push({ kind: 'gap', text: `${rows.length - 4} unchanged lines` });
        rows.slice(-2).forEach((text) => lines.push({ kind: 'same', text }));
      } else {
        rows.forEach((text) => lines.push({ kind: 'same', text }));
      }
    }
    return { lines, added, removed };
  }, [change]);
}

const ICON = { create: FilePlus, update: FilePen, delete: FileMinus } as const;

function ChangeRow({ change }: { change: AiChange }) {
  const [open, setOpen] = useState(false);
  const { lines, added, removed } = useDiff(change);
  const Icon = ICON[change.action];

  return (
    <li className="border-t border-line first:border-t-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-2"
      >
        <ChevronRight
          className={cn(
            'size-3.5 shrink-0 text-ink-muted transition-transform',
            open && 'rotate-90',
          )}
          aria-hidden
        />
        <Icon
          className={cn(
            'size-3.5 shrink-0',
            change.action === 'create' && 'text-teal',
            change.action === 'update' && 'text-cobalt',
            change.action === 'delete' && 'text-danger',
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate font-mono">{change.path}</span>
        <span className="shrink-0 tabular-nums">
          {change.action === 'delete' ? (
            <span className="text-danger">deleted</span>
          ) : change.action === 'create' ? (
            <span className="text-teal">new, {added} lines</span>
          ) : (
            <>
              <span className="text-teal">+{added}</span>{' '}
              <span className="text-danger">−{removed}</span>
            </>
          )}
        </span>
      </button>
      {open && (
        <pre className="max-h-72 overflow-auto border-t border-line bg-paper py-1 font-mono text-[11.5px] leading-5">
          {lines.map((l, i) =>
            l.kind === 'gap' ? (
              <div key={i} className="px-3 text-ink-muted italic">
                … {l.text}
              </div>
            ) : (
              <div
                key={i}
                className={cn(
                  'px-3 whitespace-pre',
                  l.kind === 'add' && 'bg-teal/12',
                  l.kind === 'del' && 'bg-rose/12 text-ink-muted',
                )}
              >
                <span className="mr-2 inline-block w-2 select-none text-ink-muted">
                  {l.kind === 'add' ? '+' : l.kind === 'del' ? '−' : ' '}
                </span>
                {l.text || ' '}
              </div>
            ),
          )}
        </pre>
      )}
    </li>
  );
}

export function ProposalCard({
  proposal,
  canDecide,
  deciding,
  deciderName,
  onDecide,
}: {
  proposal: AiProposal;
  canDecide: boolean;
  deciding: boolean;
  deciderName: string | null;
  onDecide: (decision: 'apply' | 'reject') => void;
}) {
  const pending = proposal.status === 'pending';
  return (
    <div className="mt-2 w-full max-w-md overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-start justify-between gap-3 px-3 pt-2.5 pb-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-ink-muted">
            Suggested changes, {proposal.changes.length}{' '}
            {proposal.changes.length === 1 ? 'file' : 'files'}
          </p>
          <p className="mt-0.5 text-sm">{proposal.summary}</p>
        </div>
        {!pending && (
          <span
            className={cn(
              'flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
              proposal.status === 'applied'
                ? 'bg-teal/15 text-teal'
                : 'bg-surface-2 text-ink-muted',
            )}
          >
            {proposal.status === 'applied' ? (
              <Check className="size-3" />
            ) : (
              <X className="size-3" />
            )}
            {proposal.status === 'applied' ? 'Applied' : 'Dismissed'}
            {deciderName && ` by ${deciderName}`}
          </span>
        )}
      </div>
      <ul className="border-t border-line">
        {proposal.changes.map((c) => (
          <ChangeRow key={c.path} change={c} />
        ))}
      </ul>
      {pending && (
        <div className="flex items-center justify-between gap-2 border-t border-line bg-surface-2/50 px-3 py-2">
          <p className="text-[11px] text-ink-muted">
            {canDecide ? 'Nothing changes until someone accepts.' : 'An editor can accept these.'}
          </p>
          {canDecide && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={deciding}
                onClick={() => onDecide('reject')}
              >
                Dismiss
              </Button>
              <Button size="sm" disabled={deciding} onClick={() => onDecide('apply')}>
                <Check /> Accept all
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
