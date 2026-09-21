/** A static replica of the run panel: install, dev server, and the preview it opens. */
const lines: { text: string; tone?: 'muted' | 'ok' | 'cmd' }[] = [
  { text: '$ npm install', tone: 'cmd' },
  { text: 'added 214 packages in 6s', tone: 'muted' },
  { text: '$ npm run dev', tone: 'cmd' },
  { text: '  VITE v8.0.1  ready in 412 ms', tone: 'muted' },
  { text: '  ➜  Local:  http://localhost:5173/', tone: 'ok' },
];

export function RunPreview() {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-30px_rgb(27_34_51/0.45)]"
    >
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-xs">
        <span className="size-2 rounded-full bg-teal" />
        <span className="font-medium">Running</span>
        <span className="ml-auto font-mono text-ink-muted">localhost:5173</span>
      </div>

      <pre className="overflow-x-auto bg-surface-2/50 px-4 py-3 font-mono text-[12px] leading-6">
        {lines.map((l) => (
          <div
            key={l.text}
            className={
              l.tone === 'muted'
                ? 'text-ink-muted'
                : l.tone === 'ok'
                  ? 'text-teal'
                  : 'font-semibold'
            }
          >
            {l.text}
          </div>
        ))}
      </pre>

      <div className="border-t border-line p-4">
        <div className="rounded-lg border border-line bg-paper px-4 py-6">
          <div className="h-2 w-24 rounded-full bg-cobalt/70" />
          <div className="mt-3 grid gap-1.5">
            <div className="h-1.5 w-full rounded-full bg-surface-2" />
            <div className="h-1.5 w-4/5 rounded-full bg-surface-2" />
            <div className="h-1.5 w-2/3 rounded-full bg-surface-2" />
          </div>
        </div>
      </div>
    </div>
  );
}
