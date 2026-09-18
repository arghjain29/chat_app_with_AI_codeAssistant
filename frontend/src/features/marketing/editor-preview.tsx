import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * A static, decorative replica of the workspace: two collaborators editing one file
 * while the AI proposes a change. One line "types" itself once on load.
 */
const TYPED = "  if (!invite) throw new NotFound('Invite');";

const lines: { n: number; code: string; tone?: 'add' | 'remove' }[] = [
  { n: 1, code: "import { Invite } from './models';" },
  { n: 2, code: '' },
  { n: 3, code: 'export async function acceptInvite(token, user) {' },
  { n: 4, code: '  const invite = await Invite.findByToken(token);' },
  { n: 5, code: '' },
  { n: 6, code: '  if (invite.expiresAt < Date.now()) return null;', tone: 'remove' },
  {
    n: 7,
    code: "  if (invite.expiresAt < Date.now()) throw new Gone('Invite expired');",
    tone: 'add',
  },
  { n: 8, code: '  return invite.project.addMember(user, invite.role);' },
  { n: 9, code: '}' },
];

const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function useTypewriter(text: string) {
  const [count, setCount] = useState(() => (prefersReducedMotion() ? text.length : 0));
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const id = setInterval(() => {
      setCount((c) => {
        if (c >= text.length) {
          clearInterval(id);
          return c;
        }
        return c + 1;
      });
    }, 45);
    return () => clearInterval(id);
  }, [text]);
  return text.slice(0, count);
}

function Cursor({ name, color }: { name: string; color: string }) {
  return (
    <span className="relative inline-block h-[1.15em] w-0 align-text-bottom">
      <span className={cn('absolute inset-y-0 left-0 w-0.5', color)} />
      <span
        className={cn(
          'absolute -top-4 left-0 rounded-sm rounded-bl-none px-1 font-sans text-[10px] leading-4 font-semibold text-[#1b2233]',
          color,
        )}
      >
        {name}
      </span>
    </span>
  );
}

export function EditorPreview() {
  const typed = useTypewriter(TYPED);

  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-30px_rgb(27_34_51/0.45)]"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="font-mono text-xs text-ink-muted">src/invites/accept.js</span>
        <div className="flex -space-x-1.5">
          <span className="grid size-6 place-items-center rounded-full bg-marigold text-[10px] font-bold text-[#1b2233] ring-2 ring-surface">
            M
          </span>
          <span className="grid size-6 place-items-center rounded-full bg-teal text-[10px] font-bold text-white ring-2 ring-surface">
            D
          </span>
          <span className="grid size-6 place-items-center rounded-full bg-cobalt text-[10px] font-bold text-cobalt-ink ring-2 ring-surface">
            AI
          </span>
        </div>
      </div>

      <pre className="overflow-x-auto py-4 font-mono text-[12.5px] leading-6">
        {lines.map((l) => (
          <div
            key={l.n}
            className={cn(
              'flex pr-4',
              l.tone === 'add' && 'bg-teal/12',
              l.tone === 'remove' && 'bg-rose/12 text-ink-muted line-through decoration-rose/60',
            )}
          >
            <span className="w-10 shrink-0 pr-3 text-right text-ink-muted/60 select-none">
              {l.n}
            </span>
            <code className="whitespace-pre">
              {l.n === 5 ? (
                <>
                  {typed}
                  <Cursor name="maya" color="bg-marigold" />
                </>
              ) : l.n === 8 ? (
                <>
                  {'  return invite.project.'}
                  <Cursor name="dev" color="bg-teal" />
                  {'addMember(user, invite.role);'}
                </>
              ) : (
                l.code
              )}
            </code>
          </div>
        ))}
      </pre>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2/60 px-4 py-3 text-sm">
        <p>
          <span className="font-semibold">AI</span>{' '}
          <span className="text-ink-muted">suggests throwing when an invite has expired.</span>
        </p>
        <div className="flex gap-2">
          <span className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs">
            Reject
          </span>
          <span className="rounded-md bg-cobalt px-2.5 py-1 text-xs text-cobalt-ink">Accept</span>
        </div>
      </div>
    </div>
  );
}
