import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { ExternalLink, Play, RotateCw, Square } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { fetchSnapshot } from './files-api';
import { ProjectRun, runtimeSupported } from './runner';
import { detectRuntime, type Runtime } from './runtime';

type Status = 'idle' | 'preparing' | 'installing' | 'starting' | 'running' | 'exited' | 'error';

const STATUS_TEXT: Record<Status, string> = {
  idle: 'Not running',
  preparing: 'Preparing files…',
  installing: 'Installing packages…',
  starting: 'Starting…',
  running: 'Running',
  exited: 'Stopped',
  error: 'Can’t run',
};

export interface RunPanelHandle {
  /** Push a live edit into the running project. */
  syncFile(path: string, content: string): void;
}

const terminalTheme = () => {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    background: v('--surface'),
    foreground: v('--ink'),
    cursor: v('--cobalt'),
    selectionBackground: `${v('--cobalt')}40`,
  };
};

export const RunPanel = forwardRef<RunPanelHandle, { projectId: string }>(function RunPanel(
  { projectId },
  ref,
) {
  const termHost = useRef<HTMLDivElement>(null);
  const term = useRef<Terminal | null>(null);
  const fit = useRef<FitAddon | null>(null);
  const run = useRef<ProjectRun | null>(null);
  const reloadTimer = useRef<number | undefined>(undefined);
  const { theme } = useTheme();

  const [status, setStatus] = useState<Status>('idle');
  const [detail, setDetail] = useState<string>();
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [view, setView] = useState<'preview' | 'terminal'>('terminal');
  const supported = runtimeSupported();

  // Terminal setup
  useEffect(() => {
    const t = new Terminal({
      convertEol: true,
      fontFamily: 'JetBrains Mono Variable, ui-monospace, monospace',
      fontSize: 12,
      theme: terminalTheme(),
      cursorBlink: false,
    });
    const f = new FitAddon();
    t.loadAddon(f);
    t.open(termHost.current!);
    t.onData((d) => void run.current?.input(d));
    term.current = t;
    fit.current = f;
    const ro = new ResizeObserver(() => {
      try {
        f.fit();
        run.current?.resize({ cols: t.cols, rows: t.rows });
      } catch {
        // Hidden panels have no size; fit again when shown.
      }
    });
    ro.observe(termHost.current!);
    return () => {
      ro.disconnect();
      t.dispose();
    };
  }, []);

  useEffect(() => {
    if (term.current) term.current.options.theme = terminalTheme();
  }, [theme]);

  // Stop the process when leaving the project.
  useEffect(() => () => run.current?.stop(), [projectId]);

  useImperativeHandle(ref, () => ({
    syncFile(path, content) {
      const r = run.current;
      if (!r || (status !== 'running' && status !== 'starting')) return;
      void r.writeFile(path, content).then(() => {
        // Plain static sites have no dev server to hot-reload them.
        if (runtime?.kind === 'static') {
          window.clearTimeout(reloadTimer.current);
          reloadTimer.current = window.setTimeout(() => setPreviewKey((k) => k + 1), 400);
        }
      });
    },
  }));

  const stop = () => {
    run.current?.stop();
    run.current = null;
    setStatus('exited');
    setDetail(undefined);
  };

  const start = async () => {
    run.current?.stop();
    run.current = null;
    setPreviewUrl(null);
    setDetail(undefined);
    setStatus('preparing');
    const t = term.current!;
    t.clear();

    let files;
    try {
      files = await fetchSnapshot(projectId);
    } catch (err) {
      setStatus('error');
      setDetail(err instanceof Error ? err.message : 'Couldn’t load the project files.');
      return;
    }
    const rt = detectRuntime(files);
    setRuntime(rt);
    if (rt.kind === 'unsupported') {
      setStatus('error');
      setDetail(rt.reason);
      return;
    }

    const r = new ProjectRun(rt, {
      onOutput: (text) => t.write(text),
      onStatus: (s, d) => {
        setStatus(s);
        setDetail(d);
      },
      onPreview: (url) => {
        setPreviewUrl(url);
        setStatus('running');
        setView('preview');
      },
    });
    run.current = r;
    try {
      await r.start(files, { cols: t.cols, rows: t.rows });
    } catch (err) {
      setStatus('error');
      setDetail(err instanceof Error ? err.message : 'The project failed to start.');
    }
  };

  const busy = status === 'preparing' || status === 'installing' || status === 'starting';
  const active = busy || status === 'running';

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-1.5">
        {active ? (
          <>
            <Button size="sm" variant="secondary" onClick={stop}>
              <Square /> Stop
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void start()}
              title="Restart with the latest files"
            >
              <RotateCw /> Restart
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={() => void start()} disabled={!supported}>
            <Play /> Run
          </Button>
        )}

        <span className="flex items-center gap-2 text-xs text-ink-muted" aria-live="polite">
          <span
            className={cn(
              'size-2 rounded-full',
              status === 'running'
                ? 'bg-teal'
                : busy
                  ? 'animate-pulse bg-marigold'
                  : status === 'error'
                    ? 'bg-danger'
                    : 'bg-line',
            )}
          />
          {STATUS_TEXT[status]}
          {runtime && runtime.kind !== 'unsupported' && active && (
            <span className="hidden border-l border-line pl-2 font-mono sm:inline">
              {runtime.label}
            </span>
          )}
        </span>

        <div className="ml-auto flex rounded-lg border border-line p-0.5 text-xs" role="tablist">
          {(['preview', 'terminal'] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn(
                'rounded-md px-2.5 py-1 capitalize',
                view === v ? 'bg-surface-2 font-medium text-ink' : 'text-ink-muted hover:text-ink',
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {!supported && (
        <p className="border-b border-line bg-marigold/10 px-3 py-2 text-xs">
          Running projects needs Chrome, Edge or Firefox. You can still edit together in this
          browser.
        </p>
      )}
      {detail && (
        <p
          role={status === 'error' ? 'alert' : undefined}
          className={cn(
            'border-b border-line px-3 py-2 text-xs',
            status === 'error' ? 'bg-danger/8 text-ink' : 'text-ink-muted',
          )}
        >
          {detail}
        </p>
      )}

      <div className="relative min-h-0 flex-1">
        <div className={cn('absolute inset-0 p-2', view !== 'terminal' && 'invisible')}>
          <div ref={termHost} className="h-full" />
        </div>
        {view === 'preview' && (
          <div className="absolute inset-0 flex flex-col">
            {previewUrl ? (
              <>
                <div className="flex items-center gap-1 border-b border-line px-2 py-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label="Reload preview"
                    onClick={() => setPreviewKey((k) => k + 1)}
                  >
                    <RotateCw />
                  </Button>
                  <span className="min-w-0 flex-1 truncate rounded-md bg-surface-2 px-2 py-1 font-mono text-[11px] text-ink-muted">
                    {previewUrl}
                  </span>
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label="Open preview in a new tab"
                  >
                    <a href={previewUrl} target="_blank" rel="noreferrer">
                      <ExternalLink />
                    </a>
                  </Button>
                </div>
                <iframe
                  key={previewKey}
                  src={previewUrl}
                  title="Project preview"
                  className="min-h-0 flex-1 bg-white"
                  allow="cross-origin-isolated"
                />
              </>
            ) : (
              <div className="grid flex-1 place-items-center p-6 text-center text-sm text-ink-muted">
                {busy
                  ? 'The preview appears here once the project is up.'
                  : 'Press Run to see the project here. Runs happen in your browser, so they don’t affect anyone else.'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
