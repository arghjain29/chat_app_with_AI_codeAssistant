import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** A static replica of the project chat: a question, an @ai mention, and the answer arriving. */
const messages: {
  author: string;
  initial: string;
  color: string;
  body: ReactNode;
  mine?: boolean;
}[] = [
  {
    author: 'maya',
    initial: 'M',
    color: 'bg-marigold text-[#1b2233]',
    body: 'Invite links never expire right now. Should they?',
  },
  {
    author: 'dev',
    initial: 'D',
    color: 'bg-teal text-white',
    mine: true,
    body: (
      <>
        {/* Inside the cobalt bubble, the mention reads as bold, not as a second colour. */}
        <span className="font-semibold">@ai</span> make invites expire after 7 days and return 410
        when they do
      </>
    ),
  },
];

export function ChatPreview() {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-30px_rgb(27_34_51/0.45)]"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5 text-xs">
        <span className="font-medium">Chat</span>
        <span className="text-ink-muted">3 people</span>
      </div>

      <div className="grid gap-3 px-4 py-4 text-sm">
        {messages.map((m) => (
          <div key={m.author} className={cn('flex gap-2', m.mine && 'flex-row-reverse')}>
            <span
              className={cn(
                'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-bold',
                m.color,
              )}
            >
              {m.initial}
            </span>
            <p
              className={cn(
                'max-w-[78%] rounded-2xl px-3 py-2 leading-snug',
                m.mine
                  ? 'rounded-br-sm bg-cobalt text-cobalt-ink'
                  : 'rounded-bl-sm bg-surface-2 text-ink',
              )}
            >
              {m.body}
            </p>
          </div>
        ))}

        <div className="flex gap-2">
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-cobalt text-[10px] font-bold text-cobalt-ink">
            AI
          </span>
          <div className="max-w-[78%] rounded-2xl rounded-bl-sm border border-cobalt/30 bg-surface-2 px-3 py-2">
            <p className="leading-snug">
              Invites now carry an expiry. I&apos;ve set the default to 7 days and returned 410 Gone
              once it passes
              <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 bg-cobalt" />
            </p>
            <p className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
              <span className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono">
                2 files
              </span>
              Suggested changes, waiting for review
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
