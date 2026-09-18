import type { FileEntry, Me, Project } from '@codecollab/shared';
import { useQuery } from '@tanstack/react-query';
import { Code2, Eye, WifiOff, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { CodeEditor } from './code-editor';
import { FileTree } from './file-tree';
import { filesQuery } from './files-api';
import { RunPanel, type RunPanelHandle } from './run-panel';
import { useProjectRoom, type Peer } from './use-project-room';

// ---------- Small helpers ----------

const mq = typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)') : null;
const useIsDesktop = () =>
  useSyncExternalStore(
    (cb) => {
      mq?.addEventListener('change', cb);
      return () => mq?.removeEventListener('change', cb);
    },
    () => mq?.matches ?? true,
  );

/** Open tabs and the active file, remembered per project in this browser. */
function useTabs(projectId: string) {
  const key = `tabs:${projectId}`;
  const [state, setState] = useState<{ open: string[]; active: string | null }>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as {
        open: string[];
        active: string | null;
      } | null;
      if (saved && Array.isArray(saved.open)) return saved;
    } catch {
      // Storage unavailable or corrupt: start fresh.
    }
    return { open: [], active: null };
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Not critical.
    }
  }, [key, state]);

  const open = useCallback(
    (id: string) =>
      setState((s) => ({ open: s.open.includes(id) ? s.open : [...s.open, id], active: id })),
    [],
  );
  const close = useCallback(
    (id: string) =>
      setState((s) => {
        const i = s.open.indexOf(id);
        if (i === -1) return s;
        const next = s.open.filter((x) => x !== id);
        const active = s.active === id ? (next[i] ?? next[i - 1] ?? null) : s.active;
        return { open: next, active };
      }),
    [],
  );
  return { ...state, openTab: open, closeTab: close, setActive: open };
}

function PeerStack({ peers }: { peers: Peer[] }) {
  const others = peers.filter((p) => !p.isMe);
  if (others.length === 0) return null;
  return (
    <div
      className="flex items-center -space-x-1.5"
      title={`Here now: ${others.map((p) => p.user.name).join(', ')}`}
    >
      {others.slice(0, 4).map((p) => (
        <Avatar
          key={p.clientId}
          size="sm"
          className="ring-2 ring-surface"
          user={{ id: p.user.id, username: p.user.name, avatarUrl: p.user.avatarUrl }}
        />
      ))}
      {others.length > 4 && (
        <span className="grid size-6 place-items-center rounded-full bg-surface-2 text-[10px] font-semibold ring-2 ring-surface">
          +{others.length - 4}
        </span>
      )}
      <span className="sr-only">{others.length} other people here</span>
    </div>
  );
}

// ---------- Workspace ----------

export function Workspace({ project, me }: { project: Project; me: Me }) {
  const canEdit = project.role !== 'viewer';
  const { data: files = [], isPending } = useQuery(filesQuery(project.id));
  const { open, active, openTab, closeTab, setActive } = useTabs(project.id);
  const { peers, connected } = useProjectRoom(project.id, me, active, closeTab);
  const run = useRef<RunPanelHandle>(null);
  const isDesktop = useIsDesktop();
  const [mobileView, setMobileView] = useState<'files' | 'code' | 'run'>('code');

  const byId = useMemo(() => new Map(files.map((f) => [f.id, f])), [files]);

  // Drop tabs for files that no longer exist (deleted by someone, or stale storage).
  useEffect(() => {
    if (isPending) return;
    for (const id of open) if (!byId.has(id)) closeTab(id);
  }, [byId, open, isPending, closeTab]);

  // First visit: open the most useful file.
  useEffect(() => {
    if (isPending || open.length > 0) return;
    const first =
      files.find((f) => /^(README\.md|index\.html)$/i.test(f.path)) ??
      files.find((f) => f.kind === 'file');
    if (first) openTab(first.id);
    // Only when the file list first arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending]);

  const activeFile = active ? byId.get(active) : undefined;
  const openFile = (entry: FileEntry) => {
    openTab(entry.id);
    if (!isDesktop) setMobileView('code');
  };

  const layout = useDefaultLayout({ id: 'workspace-layout', storage: localStorage });

  const tree = (
    <FileTree
      projectId={project.id}
      entries={files}
      activeFileId={active}
      canEdit={canEdit}
      peers={peers}
      onOpen={openFile}
    />
  );

  const editor = (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex items-center border-b border-line">
        <div className="flex min-w-0 flex-1 overflow-x-auto" role="tablist" aria-label="Open files">
          {open.map((id) => {
            const f = byId.get(id);
            if (!f) return null;
            const name = f.path.split('/').pop();
            const isActive = id === active;
            return (
              <div
                key={id}
                className={cn(
                  'group flex shrink-0 items-center border-r border-line text-sm',
                  isActive
                    ? 'bg-surface text-ink shadow-[inset_0_-2px_0_var(--cobalt)]'
                    : 'bg-paper/60 text-ink-muted',
                )}
              >
                <button
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActive(id)}
                  className="py-2 pr-1 pl-3"
                  title={f.path}
                >
                  {name}
                </button>
                <button
                  onClick={() => closeTab(id)}
                  aria-label={`Close ${name}`}
                  className="mr-1 rounded p-0.5 opacity-60 hover:bg-surface-2 hover:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex shrink-0 items-center gap-3 px-3">
          {!connected && (
            <span className="flex items-center gap-1 text-xs text-ink-muted" role="status">
              <WifiOff className="size-3.5" aria-hidden /> Reconnecting…
            </span>
          )}
          {!canEdit && (
            <span className="flex items-center gap-1 text-xs text-ink-muted">
              <Eye className="size-3.5" aria-hidden /> Read-only
            </span>
          )}
          <PeerStack peers={peers} />
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {activeFile ? (
          <CodeEditor
            key={activeFile.id}
            fileId={activeFile.id}
            path={activeFile.path}
            readOnly={!canEdit}
            me={me}
            onChange={(text) => run.current?.syncFile(activeFile.path, text)}
          />
        ) : (
          <div className="grid h-full place-items-center p-6 text-center">
            <div>
              <Code2 className="mx-auto size-8 text-ink-muted" aria-hidden />
              <p className="mt-3 text-sm text-ink-muted">
                {files.some((f) => f.kind === 'file')
                  ? 'Pick a file to start editing.'
                  : canEdit
                    ? 'Create a file to start.'
                    : 'This project has no files yet.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const runPanel = <RunPanel ref={run} projectId={project.id} />;

  if (!isDesktop) {
    return (
      <div data-workspace className="flex min-h-0 flex-1 flex-col">
        <div className="flex border-b border-line bg-surface p-1 text-sm" role="tablist">
          {(['files', 'code', 'run'] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={mobileView === v}
              onClick={() => setMobileView(v)}
              className={cn(
                'flex-1 rounded-md py-1.5 capitalize',
                mobileView === v ? 'bg-surface-2 font-medium' : 'text-ink-muted',
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="relative min-h-[60dvh] flex-1">
          {/* Keep all three mounted so the editor and a running project survive switching. */}
          <div className={cn('absolute inset-0 bg-surface', mobileView !== 'files' && 'hidden')}>
            {tree}
          </div>
          <div className={cn('absolute inset-0', mobileView !== 'code' && 'hidden')}>{editor}</div>
          <div className={cn('absolute inset-0', mobileView !== 'run' && 'hidden')}>{runPanel}</div>
        </div>
      </div>
    );
  }

  return (
    <Group
      data-workspace
      orientation="horizontal"
      className="min-h-0 flex-1"
      defaultLayout={layout.defaultLayout}
      onLayoutChanged={layout.onLayoutChanged}
    >
      <Panel id="tree" defaultSize="18" minSize="160px" maxSize="35" className="bg-surface">
        {tree}
      </Panel>
      <Separator className="w-px bg-line transition-colors hover:bg-cobalt data-[separator=active]:bg-cobalt" />
      <Panel id="editor" defaultSize="47" minSize="25">
        {editor}
      </Panel>
      <Separator className="w-px bg-line transition-colors hover:bg-cobalt data-[separator=active]:bg-cobalt" />
      <Panel id="run" defaultSize="35" minSize="20">
        {runPanel}
      </Panel>
    </Group>
  );
}
