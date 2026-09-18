import type { Member } from '@codecollab/shared';
import { memo } from 'react';
import Markdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

/**
 * Chat message text. Markdown only: raw HTML is never rendered, so messages can't
 * inject markup. `@name` mentions of real members are highlighted.
 */
export const MessageText = memo(function MessageText({
  content,
  members,
  meId,
}: {
  content: string;
  members: Member[];
  meId: string | undefined;
}) {
  const byName = new Map(members.map((m) => [m.username.toLowerCase(), m]));
  // Turn mentions into links with a private scheme, rendered as highlighted names below.
  const withMentions = content.replace(
    /(^|[^\w@`])@([a-z0-9_-]{2,32})\b/gi,
    (all, before: string, name: string) =>
      byName.has(name.toLowerCase()) ? `${before}[@${name}](mention:${name.toLowerCase()})` : all,
  );

  return (
    <div className="chat-markdown text-sm leading-relaxed break-words">
      <Markdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => (url.startsWith('mention:') ? url : defaultUrlTransform(url))}
        components={{
          a: ({ href, children }) => {
            if (href?.startsWith('mention:')) {
              const member = byName.get(href.slice('mention:'.length));
              return (
                <span
                  className={cn(
                    'rounded px-0.5 font-medium',
                    member?.id === meId ? 'bg-marigold/30' : 'bg-cobalt/12 text-cobalt',
                  )}
                >
                  {children}
                </span>
              );
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cobalt underline"
              >
                {children}
              </a>
            );
          },
          pre: ({ children }) => (
            <pre className="my-1.5 overflow-x-auto rounded-lg border border-line bg-paper p-2.5 font-mono text-[12px] leading-5">
              {children}
            </pre>
          ),
          code: ({ className, children }) => (
            <code
              className={cn(
                'font-mono text-[12px]',
                !className && 'rounded bg-surface-2 px-1 py-0.5',
                className,
              )}
            >
              {children}
            </code>
          ),
          p: ({ children }) => <p className="my-0.5">{children}</p>,
          ul: ({ children }) => <ul className="my-1 list-disc pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-1 list-decimal pl-5">{children}</ol>,
          blockquote: ({ children }) => (
            <blockquote className="my-1 border-l-2 border-line pl-3 text-ink-muted">
              {children}
            </blockquote>
          ),
          img: ({ alt }) => <span className="text-ink-muted">[image: {alt}]</span>,
        }}
      >
        {withMentions}
      </Markdown>
    </div>
  );
});
