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

  return (
    <article
      className={cn(
        'group relative flex gap-2.5 px-3 hover:bg-surface-2/50',
        compact ? 'py-0.5' : 'pt-2.5 pb-0.5',
        mentionsMe && !deleted && 'bg-marigold/8 shadow-[inset_2px_0_0_var(--marigold)]',
        pending && 'opacity-70',
      )}
      aria-label={`${message.author?.username ?? 'System'}: ${deleted ? 'deleted message' : message.content}`}
    >
      <div className="w-8 shrink-0">
        {!compact && message.author && <Avatar user={message.author} />}
      </div>

      <div className="min-w-0 flex-1">
        {!compact && (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">
              {message.author?.username ?? 'CodeCollab'}
            </span>
            <time
              dateTime={message.createdAt}
              className="text-[11px] text-ink-muted"
              title={new Date(message.createdAt).toLocaleString()}
            >
              {timeOf(message.createdAt)}
            </time>
          </div>
        )}

        {deleted ? (
          <p className="text-sm text-ink-muted italic">This message was deleted.</p>
        ) : editing ? (
          <div className="mt-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onEditKey}
              autoFocus
              rows={Math.min(8, draft.split('\n').length + 1)}
              aria-label="Edit message"
              className="w-full resize-none rounded-lg border border-cobalt bg-surface p-2 text-sm outline-none"
            />
            <div className="mt-1 flex gap-2 text-xs">
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
              <span className="self-center text-ink-muted">Enter to save, Esc to cancel</span>
            </div>
          </div>
        ) : (
          <>
            <MessageText content={message.content} members={members} meId={meId} />
            {message.editedAt && <span className="text-[11px] text-ink-muted">(edited)</span>}
          </>
        )}

        {pending && (
          <p className="text-xs" role={pending.status === 'failed' ? 'alert' : undefined}>
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
          <div className="mt-1 flex flex-wrap gap-1">
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
            className="mt-1 text-xs font-medium text-cobalt hover:underline"
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

      {actionsAvailable && (
        <div className="absolute -top-3 right-3 hidden items-center rounded-lg border border-line bg-surface shadow-sm group-focus-within:flex group-hover:flex">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 text-ink-muted hover:text-ink" aria-label="Add reaction">
                <SmilePlus className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-0">
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
                <button className="p-1.5 text-ink-muted hover:text-ink" aria-label="More actions">
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
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
    </article>
  );
}
