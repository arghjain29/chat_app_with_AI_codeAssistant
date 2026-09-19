import { REACTIONS, type ChatMessage, type Member, type Reaction } from '@codecollab/shared';
import { MessageSquare, MoreHorizontal, Pencil, SmilePlus, Trash2 } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { MessageText } from './markdown';

export interface PendingState {
  status: 'sending' | 'failed';
  retry: () => void;
  discard: () => void;
}

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export function MessageItem({
  message,
  compact,
  meId,
  isOwner,
  members,
  pending,
  inThread,
  onReact,
  onReply,
  onEdit,
  onDelete,
}: {
  message: ChatMessage;
  /** Same author as the previous message, shortly after: hide the header. */
  compact: boolean;
  meId: string;
  isOwner: boolean;
  members: Member[];
  pending?: PendingState;
  inThread?: boolean;
  onReact: (emoji: Reaction) => void;
  onReply?: () => void;
  onEdit: (content: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const mine = message.author?.id === meId;
  const deleted = !!message.deletedAt;
  const mentionsMe = message.mentions.includes(meId);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.username ?? 'someone';

  const saveEdit = () => {
    const content = draft.trim();
    if (content && content !== message.content) onEdit(content);
    setEditing(false);
  };
  const onEditKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      setEditing(false);
      setDraft(message.content);
    }
  };

  const actionsAvailable = !pending && !deleted && !editing;
  const time = (
    <time
      dateTime={message.createdAt}
      title={new Date(message.createdAt).toLocaleString()}
      className="ml-2 inline-block translate-y-0.5 text-[10px] whitespace-nowrap text-ink-muted"
    >
      {message.editedAt && 'edited, '}
      {timeOf(message.createdAt)}
    </time>
  );

  return (
    // Your own messages sit on the right, everyone else's on the left (like WhatsApp).
    <article
      className={cn(
        'group flex gap-2 px-3',
        mine ? 'flex-row-reverse' : 'flex-row',
        compact ? 'pt-0.5' : 'pt-3',
        pending && 'opacity-70',
      )}
      aria-label={`${mine ? 'You' : (message.author?.username ?? 'System')}: ${deleted ? 'deleted message' : message.content}`}
    >
      {!mine && (
        <div className="w-8 shrink-0">
          {!compact && message.author && <Avatar user={message.author} />}
        </div>
      )}

      <div className={cn('flex max-w-[85%] min-w-0 flex-col', mine ? 'items-end' : 'items-start')}>
        {!compact && !mine && (
          <span className="mb-0.5 px-1 text-xs font-semibold">
            {message.author?.username ?? 'CodeCollab'}
          </span>
        )}

        <div className="relative max-w-full">
          <div
            className={cn(
              'rounded-2xl px-3 py-1.5',
              deleted
                ? 'border border-dashed border-line'
                : mine
                  ? 'rounded-tr-md bg-cobalt/12'
                  : 'rounded-tl-md bg-surface-2',
              compact && (mine ? 'rounded-tr-2xl' : 'rounded-tl-2xl'),
              mentionsMe && !deleted && 'ring-2 ring-marigold/70',
            )}
          >
            {deleted ? (
              <p className="text-sm text-ink-muted italic">This message was deleted.{time}</p>
            ) : editing ? (
              <div className="w-72 max-w-full py-1">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onEditKey}
                  autoFocus
                  rows={Math.min(8, draft.split('\n').length + 1)}
                  aria-label="Edit message"
                  className="w-full resize-none rounded-lg border border-cobalt bg-surface p-2 text-sm outline-none"
                />
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <Button size="sm" onClick={saveEdit}>
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(false);
                      setDraft(message.content);
                    }}
                  >
                    Cancel
                  </Button>
                  <span className="text-ink-muted">Enter to save, Esc to cancel</span>
                </div>
              </div>
            ) : (
              <div className="[&_.chat-markdown>*:last-child]:inline">
                <MessageText content={message.content} members={members} meId={meId} />
                {time}
              </div>
            )}
          </div>

          {actionsAvailable && (
            // Hidden with opacity, not display: a menu needs its trigger to stay laid out,
            // otherwise it opens in the top-left corner of the screen.
            <div
              className={cn(
                'pointer-events-none absolute -top-4 flex items-center rounded-lg border border-line bg-surface opacity-0 shadow-sm transition-opacity',
                'group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100',
                'has-[[data-state=open]]:pointer-events-auto has-[[data-state=open]]:opacity-100',
                mine ? 'left-1' : 'right-1',
              )}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1.5 text-ink-muted hover:text-ink" aria-label="Add reaction">
                    <SmilePlus className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={mine ? 'start' : 'end'} className="min-w-0">
                  <div className="grid grid-cols-4 gap-0.5">
                    {REACTIONS.map((emoji) => (
                      <DropdownMenuItem
                        key={emoji}
                        onSelect={() => onReact(emoji)}
                        className="justify-center px-2 text-base"
                        aria-label={`React with ${emoji}`}
                      >
                        {emoji}
                      </DropdownMenuItem>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              {!inThread && onReply && (
                <button
                  onClick={onReply}
                  className="p-1.5 text-ink-muted hover:text-ink"
                  aria-label="Reply in thread"
                >
                  <MessageSquare className="size-4" />
                </button>
              )}
              {(mine || isOwner) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="p-1.5 text-ink-muted hover:text-ink"
                      aria-label="More actions"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={mine ? 'start' : 'end'}>
                    {mine && (
                      <DropdownMenuItem
                        onSelect={() => {
                          setDraft(message.content);
                          setEditing(true);
                        }}
                      >
                        <Pencil /> Edit
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem destructive onSelect={onDelete}>
                      <Trash2 /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>

        {pending && (
          <p
            className="mt-0.5 px-1 text-xs"
            role={pending.status === 'failed' ? 'alert' : undefined}
          >
            {pending.status === 'sending' ? (
              <span className="text-ink-muted">Sending…</span>
            ) : (
              <span className="text-danger">
                Not sent.{' '}
                <button className="font-medium underline" onClick={pending.retry}>
                  Retry
                </button>{' '}
                or{' '}
                <button className="underline" onClick={pending.discard}>
                  discard
                </button>
              </span>
            )}
          </p>
        )}

        {!deleted && message.reactions.length > 0 && (
          <div className={cn('mt-1 flex flex-wrap gap-1', mine && 'justify-end')}>
            {message.reactions.map((r) => {
              const reacted = r.userIds.includes(meId);
              return (
                <button
                  key={r.emoji}
                  onClick={() => onReact(r.emoji as Reaction)}
                  title={r.userIds.map(nameOf).join(', ')}
                  aria-pressed={reacted}
                  className={cn(
                    'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
                    reacted
                      ? 'border-cobalt/50 bg-cobalt/10'
                      : 'border-line bg-surface hover:bg-surface-2',
                  )}
                >
                  <span>{r.emoji}</span>
                  <span className="tabular-nums">{r.userIds.length}</span>
                </button>
              );
            })}
          </div>
        )}

        {!inThread && message.replyCount > 0 && onReply && (
          <button
            onClick={onReply}
            className="mt-1 px-1 text-xs font-medium text-cobalt hover:underline"
          >
            {message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
            {message.lastReplyAt && (
              <span className="font-normal text-ink-muted">
                , last {relativeTime(message.lastReplyAt)}
              </span>
            )}
          </button>
        )}
      </div>
    </article>
  );
}
