import type { ChatMessage, Me, Member, Project } from '@codecollab/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, MessagesSquare } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { membersQuery } from '../projects/api';
import type { Peer } from '../workspace/use-project-room';
import {
  flattenPages,
  messagesQuery,
  threadQuery,
  useDeleteMessage,
  useEditMessage,
  useMarkRead,
  useReact,
  useSendMessage,
} from './chat-api';
import { Composer } from './composer';
import { MessageItem, type PendingState } from './message-item';

interface Pending {
  clientId: string;
  content: string;
  parentId: string | null;
  status: 'sending' | 'failed';
  createdAt: string;
}

const GROUP_WINDOW_MS = 5 * 60 * 1000;

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
};

/** Show the pending copy as a message until the server's version arrives. */
const pendingAsMessage = (p: Pending, me: Me, projectId: string): ChatMessage => ({
  id: `pending:${p.clientId}`,
  projectId,
  kind: 'user',
  author: { id: me.id, username: me.username, avatarUrl: me.avatarUrl },
  content: p.content,
  parentId: p.parentId,
  replyCount: 0,
  lastReplyAt: null,
  mentions: [],
  reactions: [],
  editedAt: null,
  deletedAt: null,
  createdAt: p.createdAt,
  clientId: p.clientId,
});

export function ChatPanel({
  project,
  me,
  visible,
  peers,
  onTyping,
}: {
  project: Project;
  me: Me;
  /** Whether the chat is on screen; messages are only marked read when it is. */
  visible: boolean;
  peers: Peer[];
  onTyping: (where: string | null) => void;
}) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<ChatMessage | null>(null);
  const { data: members = [] } = useQuery(membersQuery(project.id));

  const main = useInfiniteQuery(messagesQuery(project.id));
  const thread = useQuery({ ...threadQuery(project.id, threadId ?? ''), enabled: !!threadId });

  const send = useSendMessage(project.id);
  const edit = useEditMessage(project.id);
  const del = useDeleteMessage(project.id);
  const react = useReact(project.id);
  const markRead = useMarkRead(project.id);

  const isOwner = project.role === 'owner';
  const where = threadId ?? 'main';

  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const prevHeight = useRef<number | null>(null);

  /** Switch between the main chat and a thread, starting at the newest message. */
  const lastView = useRef(threadId);
  const openThread = (id: string | null) => {
    setShowJump(false);
    setThreadId(id);
  };

  // ---- Sending with optimistic copies ----

  const submit = useCallback(
    (p: Pending) => {
      send.mutate(
        { content: p.content, parentId: p.parentId, clientId: p.clientId },
        {
          onSuccess: () => setPending((list) => list.filter((x) => x.clientId !== p.clientId)),
          onError: () =>
            setPending((list) =>
              list.map((x) => (x.clientId === p.clientId ? { ...x, status: 'failed' } : x)),
            ),
        },
      );
    },
    [send],
  );

  const onSend = (content: string) => {
    const p: Pending = {
      clientId: crypto.randomUUID(),
      content,
      parentId: threadId,
      status: 'sending',
      createdAt: new Date().toISOString(),
    };
    setPending((list) => [...list, p]);
    submit(p);
    stickToBottom.current = true;
  };

  // ---- What to show ----

  const serverMessages = useMemo(
    () => (threadId ? (thread.data?.replies ?? []) : flattenPages(main.data)),
    [threadId, thread.data, main.data],
  );
  const shown = useMemo(() => {
    const confirmed = new Set(serverMessages.map((m) => m.clientId).filter(Boolean));
    const mine = pending
      .filter((p) => p.parentId === threadId && !confirmed.has(p.clientId))
      .map((p) => pendingAsMessage(p, me, project.id));
    return [...serverMessages, ...mine];
  }, [serverMessages, pending, threadId, me, project.id]);

  const pendingFor = (m: ChatMessage): PendingState | undefined => {
    const p = pending.find((x) => `pending:${x.clientId}` === m.id);
    if (!p) return undefined;
    return {
      status: p.status,
      retry: () => {
        setPending((list) =>
          list.map((x) => (x.clientId === p.clientId ? { ...x, status: 'sending' } : x)),
        );
        submit({ ...p, status: 'sending' });
      },
      discard: () => setPending((list) => list.filter((x) => x.clientId !== p.clientId)),
    };
  };

  // ---- Scrolling ----

  const atBottom = () => {
    const el = scroller.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (lastView.current !== threadId) {
      // Switched between the main chat and a thread: start at the newest message.
      lastView.current = threadId;
      stickToBottom.current = true;
      el.scrollTop = el.scrollHeight;
      return;
    }
    if (prevHeight.current !== null) {
      // Older messages were added above: keep the view where it was.
      el.scrollTop += el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    } else {
      setShowJump(true);
    }
  }, [shown.length, threadId]);

  const loadOlder = () => {
    if (threadId || !main.hasNextPage || main.isFetchingNextPage) return;
    prevHeight.current = scroller.current?.scrollHeight ?? null;
    void main.fetchNextPage();
  };

  const onScroll = () => {
    const bottom = atBottom();
    stickToBottom.current = bottom;
    if (bottom) setShowJump(false);
    if ((scroller.current?.scrollTop ?? 1) < 80) loadOlder();
  };

  // ---- Read state ----

  const latestId = shown.at(-1)?.id;
  useEffect(() => {
    if (!visible || project.unreadCount === 0 || !atBottom()) return;
    const t = window.setTimeout(() => markRead.mutate(), 600);
    return () => window.clearTimeout(t);
    // markRead is stable enough; re-run when new messages arrive or visibility changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, latestId, project.unreadCount, showJump]);

  // ---- Typing ----

  // Typing flags clear themselves after a few idle seconds, or when the person leaves.
  const typers = peers.filter((p) => !p.isMe && p.typing?.in === where);
  const typingText =
    typers.length === 0
      ? ''
      : typers.length === 1
        ? `${typers[0]!.user.name} is typing…`
        : typers.length === 2
          ? `${typers[0]!.user.name} and ${typers[1]!.user.name} are typing…`
          : 'Several people are typing…';

  // ---- Render ----

  const root = thread.data?.root;
  const loading = threadId ? thread.isPending : main.isPending;
  const error = threadId ? thread.error : main.error;

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      {threadId && (
        <div className="flex items-center gap-2 border-b border-line px-2 py-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => openThread(null)}
            aria-label="Back to chat"
          >
            <ArrowLeft />
          </Button>
          <h3 className="text-sm font-semibold">Thread</h3>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          onScroll={onScroll}
          className="h-full overflow-y-auto py-2"
          role="log"
          aria-live="polite"
          aria-label={threadId ? 'Thread messages' : 'Project chat'}
        >
          {!threadId && main.isFetchingNextPage && (
            <p className="py-2 text-center text-xs text-ink-muted">Loading earlier messages…</p>
          )}
          {!threadId && main.hasNextPage === false && shown.length > 0 && (
            <p className="px-4 pt-2 pb-4 text-center text-xs text-ink-muted">
              This is the start of the {project.name} chat.
            </p>
          )}

          {threadId && root && (
            <div className="mb-2 border-b border-line pb-2">
              <MessageItem
                message={root}
                compact={false}
                inThread
                meId={me.id}
                isOwner={isOwner}
                members={members}
                onReact={(emoji) => react.mutate({ id: root.id, emoji })}
                onEdit={(content) => edit.mutate({ id: root.id, content })}
                onDelete={() => setConfirmDelete(root)}
              />
              <p className="px-14 pt-1 text-xs text-ink-muted">
                {root.replyCount} {root.replyCount === 1 ? 'reply' : 'replies'}
              </p>
            </div>
          )}

          {error ? (
            <p role="alert" className="px-4 py-6 text-center text-sm text-ink-muted">
              Couldn’t load messages: {error.message}
            </p>
          ) : loading ? (
            <div className="space-y-4 px-3 py-2" aria-busy="true">
              {[60, 85, 40].map((w) => (
                <div key={w} className="flex gap-2.5">
                  <span className="size-8 animate-pulse rounded-full bg-surface-2" />
                  <span
                    className="h-10 animate-pulse rounded-lg bg-surface-2"
                    style={{ width: `${w}%` }}
                  />
                </div>
              ))}
            </div>
          ) : shown.length === 0 ? (
            <div className="grid h-full place-items-center px-6 text-center">
              <div>
                <MessagesSquare className="mx-auto size-8 text-ink-muted" aria-hidden />
                <p className="mt-3 text-sm text-ink-muted">
                  {threadId
                    ? 'No replies yet. Start the thread below.'
                    : 'No messages yet. Say hi, or mention a teammate with @.'}
                </p>
              </div>
            </div>
          ) : (
            shown.map((m, i) => {
              const prev = shown[i - 1];
              const newDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
              const compact =
                !newDay &&
                !!prev &&
                prev.author?.id === m.author?.id &&
                !prev.deletedAt &&
                new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() <
                  GROUP_WINDOW_MS;
              return (
                <div key={m.clientId ?? m.id}>
                  {newDay && (
                    <div className="my-2 flex items-center gap-3 px-3 text-[11px] font-medium text-ink-muted">
                      <span className="h-px flex-1 bg-line" />
                      {dayLabel(m.createdAt)}
                      <span className="h-px flex-1 bg-line" />
                    </div>
                  )}
                  <MessageItem
                    message={m}
                    compact={compact}
                    inThread={!!threadId}
                    meId={me.id}
                    isOwner={isOwner}
                    members={members as Member[]}
                    pending={pendingFor(m)}
                    onReact={(emoji) => react.mutate({ id: m.id, emoji })}
                    onReply={threadId ? undefined : () => openThread(m.id)}
                    onEdit={(content) => edit.mutate({ id: m.id, content })}
                    onDelete={() => setConfirmDelete(m)}
                  />
                </div>
              );
            })
          )}
        </div>

        {showJump && (
          <button
            onClick={() => {
              const el = scroller.current;
              if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
              stickToBottom.current = true;
              setShowJump(false);
            }}
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-cobalt px-3 py-1 text-xs font-medium text-cobalt-ink shadow-lg animate-in fade-in-0 slide-in-from-bottom-1"
          >
            <ArrowDown className="size-3.5" /> New messages
          </button>
        )}
      </div>

      <p
        className={cn('h-5 px-4 text-[11px] text-ink-muted', !typingText && 'invisible')}
        aria-live="polite"
      >
        {typingText}
      </p>

      <Composer
        key={where}
        placeholder={threadId ? 'Reply in thread' : `Message ${project.name}`}
        members={members}
        meId={me.id}
        onSend={onSend}
        onTyping={(typing) => onTyping(typing ? where : null)}
      />

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent
          title="Delete this message?"
          description="It will be removed for everyone. Replies in its thread stay."
        >
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmDelete) {
                  del.mutate(confirmDelete.id, {
                    onSuccess: () => toast.success('Message deleted'),
                  });
                }
                setConfirmDelete(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
