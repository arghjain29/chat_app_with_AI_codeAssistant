import { CHAT_LIMITS, type Member } from '@codecollab/shared';
import { SendHorizontal } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MENTION_AT_CARET = /(?:^|\s)@([\w-]{0,32})$/;

export function Composer({
  placeholder,
  members,
  meId,
  onSend,
  onTyping,
  autoFocus,
}: {
  placeholder: string;
  members: Member[];
  meId: string;
  onSend: (content: string) => void;
  onTyping: (typing: boolean) => void;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState('');
  const [mention, setMention] = useState<{ query: string; index: number } | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const typingTimer = useRef<number | undefined>(undefined);
  const lastTypingSent = useRef(0);

  // Grow with the content, up to about eight lines. Also re-measure when the width changes:
  // measured while its panel was still being laid out, the placeholder wraps into many lines.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
    };
    fit();
    let lastWidth = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== lastWidth) {
        lastWidth = el.clientWidth;
        fit();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);

  useEffect(() => () => window.clearTimeout(typingTimer.current), []);

  const candidates = mention
    ? members
        .filter(
          (m) => m.id !== meId && m.username.toLowerCase().startsWith(mention.query.toLowerCase()),
        )
        .slice(0, 6)
    : [];

  const signalTyping = () => {
    const now = Date.now();
    if (now - lastTypingSent.current > 2000) {
      lastTypingSent.current = now;
      onTyping(true);
    }
    window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      lastTypingSent.current = 0;
      onTyping(false);
    }, 4000);
  };

  const updateMention = (value: string, caret: number) => {
    const m = MENTION_AT_CARET.exec(value.slice(0, caret));
    setMention(m ? { query: m[1]!, index: 0 } : null);
  };

  const pickMention = (member: Member) => {
    const el = ref.current!;
    const caret = el.selectionStart;
    const before = text.slice(0, caret).replace(/@([\w-]{0,32})$/, `@${member.username} `);
    const next = before + text.slice(caret);
    setText(next);
    setMention(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(before.length, before.length);
    });
  };

  const send = () => {
    const content = text.trim();
    if (!content || content.length > CHAT_LIMITS.maxMessageLength) return;
    onSend(content);
    setText('');
    setMention(null);
    window.clearTimeout(typingTimer.current);
    lastTypingSent.current = 0;
    onTyping(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && candidates.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        setMention({
          ...mention,
          index: (mention.index + delta + candidates.length) % candidates.length,
        });
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pickMention(candidates[mention.index]!);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const over = text.length - CHAT_LIMITS.maxMessageLength;

  return (
    <div className="relative border-t border-line p-2">
      {mention && candidates.length > 0 && (
        <ul
          role="listbox"
          aria-label="Mention someone"
          className="absolute right-2 bottom-full left-2 mb-1 max-h-56 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-lg"
        >
          {candidates.map((m, i) => (
            <li
              key={m.id}
              role="option"
              aria-selected={i === mention.index}
              onMouseDown={(e) => {
                e.preventDefault();
                pickMention(m);
              }}
              className={cn(
                'flex cursor-default items-center gap-2 rounded-lg px-2 py-1.5 text-sm',
                i === mention.index && 'bg-surface-2',
              )}
            >
              <Avatar user={m} size="sm" />
              {m.username}
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-2 rounded-xl border border-line bg-surface px-2 py-1.5 focus-within:border-cobalt focus-within:ring-2 focus-within:ring-cobalt/20">
        <textarea
          ref={ref}
          rows={1}
          value={text}
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            updateMention(e.target.value, e.target.selectionStart);
            if (e.target.value) signalTyping();
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setMention(null)}
          className="max-h-45 min-h-6 flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-ink-muted/70"
        />
        <Button
          size="icon"
          className="size-8 shrink-0"
          onClick={send}
          disabled={!text.trim() || over > 0}
          aria-label="Send message"
        >
          <SendHorizontal />
        </Button>
      </div>
      <div className="mt-1 flex justify-between px-1 text-[11px] text-ink-muted">
        <span className="hidden sm:inline">
          Enter to send, Shift+Enter for a new line, @ to mention
        </span>
        {text.length > CHAT_LIMITS.maxMessageLength - 400 && (
          <span className={cn('ml-auto', over > 0 && 'font-medium text-danger')}>
            {over > 0 ? `${over} characters over the limit` : `${-over} characters left`}
          </span>
        )}
      </div>
    </div>
  );
}
