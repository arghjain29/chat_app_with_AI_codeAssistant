import { FilePathSchema, type FileEntry } from '@codecollab/shared';
import {
  ChevronRight,
  FileCode2,
  FileJson,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { presenceClass } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field, Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCreateFile, useDeleteFile, useMoveFile } from './files-api';
import type { Peer } from './use-project-room';

interface TreeNode {
  entry: FileEntry;
  name: string;
  children: TreeNode[];
}

/** Turn the flat, path-sorted list into a tree: folders first, then files, A–Z. */
function buildTree(entries: FileEntry[]): TreeNode[] {
  const root: TreeNode[] = [];
  const byPath = new Map<string, TreeNode>();
  for (const entry of [...entries].sort((a, b) => a.path.localeCompare(b.path))) {
    const node: TreeNode = { entry, name: entry.path.split('/').pop()!, children: [] };
    byPath.set(entry.path, node);
    const parent = byPath.get(entry.path.split('/').slice(0, -1).join('/'));
    (parent ? parent.children : root).push(node);
  }
  const sort = (nodes: TreeNode[]) => {
    nodes.sort(
      (a, b) =>
        Number(b.entry.kind === 'folder') - Number(a.entry.kind === 'folder') ||
        a.name.localeCompare(b.name),
    );
    nodes.forEach((n) => sort(n.children));
  };
  sort(root);
  return root;
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase();
  const Icon =
    ext === 'json' ? FileJson : ['md', 'txt', 'mdx'].includes(ext ?? '') ? FileText : FileCode2;
  return <Icon className="size-4 shrink-0 text-ink-muted" aria-hidden />;
}

type DialogState =
  | { mode: 'create'; kind: 'file' | 'folder'; parent: string }
  | { mode: 'rename'; entry: FileEntry }
  | { mode: 'delete'; entry: FileEntry }
  | null;

export function FileTree({
  projectId,
  entries,
  activeFileId,
  canEdit,
  peers,
  onOpen,
}: {
  projectId: string;
  entries: FileEntry[];
  activeFileId: string | null;
  canEdit: boolean;
  peers: Peer[];
  onOpen: (entry: FileEntry) => void;
}) {
  const tree = useMemo(() => buildTree(entries), [entries]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [dialog, setDialog] = useState<DialogState>(null);

  // Who is looking at which file (other people only).
  const peersByFile = useMemo(() => {
    const map = new Map<string, Peer[]>();
    for (const p of peers) {
      if (p.isMe || !p.fileId) continue;
      map.set(p.fileId, [...(map.get(p.fileId) ?? []), p]);
    }
    return map;
  }, [peers]);

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const renderNode = (node: TreeNode, depth: number) => {
    const { entry } = node;
    const isFolder = entry.kind === 'folder';
    const isOpen = expanded.has(entry.path);
    const here = peersByFile.get(entry.id) ?? [];

    return (
      <li key={entry.id} role="none">
        <div
          className={cn(
            'group flex items-center rounded-md pr-1 text-sm hover:bg-surface-2',
            entry.id === activeFileId && 'bg-cobalt/10 text-ink hover:bg-cobalt/15',
          )}
        >
          <button
            type="button"
            role="treeitem"
            aria-expanded={isFolder ? isOpen : undefined}
            aria-selected={entry.id === activeFileId}
            onClick={() => (isFolder ? toggle(entry.path) : onOpen(entry))}
            className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left"
            style={{ paddingLeft: `${depth * 12 + 6}px` }}
            title={entry.path}
          >
            {isFolder ? (
              <>
                <ChevronRight
                  className={cn(
                    'size-3.5 shrink-0 text-ink-muted transition-transform',
                    isOpen && 'rotate-90',
                  )}
                  aria-hidden
                />
                {isOpen ? (
                  <FolderOpen className="size-4 shrink-0 text-ink-muted" aria-hidden />
                ) : (
                  <Folder className="size-4 shrink-0 text-ink-muted" aria-hidden />
                )}
              </>
            ) : (
              <>
                <span className="w-3.5 shrink-0" />
                <FileIcon name={node.name} />
              </>
            )}
            <span className="truncate">{node.name}</span>
          </button>

          {here.length > 0 && (
            <span
              className="mr-1 flex -space-x-1"
              title={`${here.map((p) => p.user.name).join(', ')} ${here.length === 1 ? 'is' : 'are'} here`}
            >
              {here.slice(0, 3).map((p) => (
                <span
                  key={p.clientId}
                  className={cn(
                    'size-2 rounded-full ring-2 ring-surface',
                    presenceClass(p.user.id),
                  )}
                />
              ))}
            </span>
          )}

          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Actions for ${node.name}`}
                  className="rounded p-1 text-ink-muted opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-surface hover:text-ink data-[state=open]:opacity-100"
                >
                  <MoreHorizontal className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {isFolder && (
                  <>
                    <DropdownMenuItem
                      onSelect={() =>
                        setDialog({ mode: 'create', kind: 'file', parent: entry.path })
                      }
                    >
                      <FilePlus /> New file here
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        setDialog({ mode: 'create', kind: 'folder', parent: entry.path })
                      }
                    >
                      <FolderPlus /> New folder here
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem onSelect={() => setDialog({ mode: 'rename', entry })}>
                  <Pencil /> Rename or move
                </DropdownMenuItem>
                <DropdownMenuItem destructive onSelect={() => setDialog({ mode: 'delete', entry })}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {isFolder && isOpen && node.children.length > 0 && (
          <ul role="group">{node.children.map((c) => renderNode(c, depth + 1))}</ul>
        )}
      </li>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="text-xs font-semibold text-ink-muted">Files</h2>
        {canEdit && (
          <div className="flex">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="New file"
              title="New file"
              onClick={() => setDialog({ mode: 'create', kind: 'file', parent: '' })}
            >
              <FilePlus />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="New folder"
              title="New folder"
              onClick={() => setDialog({ mode: 'create', kind: 'folder', parent: '' })}
            >
              <FolderPlus />
            </Button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {tree.length === 0 ? (
          <p className="px-3 py-6 text-sm text-ink-muted">
            {canEdit ? 'No files yet. Create one to start.' : 'This project has no files yet.'}
          </p>
        ) : (
          <ul role="tree" aria-label="Project files">
            {tree.map((n) => renderNode(n, 0))}
          </ul>
        )}
      </div>

      <FileDialogs
        projectId={projectId}
        state={dialog}
        onClose={() => setDialog(null)}
        onCreated={(entry) => {
          // Reveal what was just created.
          setExpanded((prev) => {
            const next = new Set(prev);
            const parts = entry.path.split('/');
            for (let i = 1; i < parts.length; i++) next.add(parts.slice(0, i).join('/'));
            return next;
          });
          if (entry.kind === 'file') onOpen(entry);
        }}
      />
    </div>
  );
}

function FileDialogs({
  projectId,
  state,
  onClose,
  onCreated,
}: {
  projectId: string;
  state: DialogState;
  onClose: () => void;
  onCreated: (entry: FileEntry) => void;
}) {
  const create = useCreateFile(projectId);
  const move = useMoveFile(projectId);
  const del = useDeleteFile(projectId);
  const [error, setError] = useState<string>();

  const close = () => {
    setError(undefined);
    onClose();
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!state || state.mode === 'delete') return;
    const raw = String(new FormData(e.currentTarget).get('path') ?? '');
    const parsed = FilePathSchema.safeParse(raw);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    const onError = (err: unknown) =>
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');

    if (state.mode === 'create') {
      create.mutate(
        { path: parsed.data, kind: state.kind },
        {
          onSuccess: (entry) => {
            close();
            onCreated(entry);
          },
          onError,
        },
      );
    } else {
      move.mutate({ id: state.entry.id, path: parsed.data }, { onSuccess: () => close(), onError });
    }
  };

  if (state?.mode === 'delete') {
    const isFolder = state.entry.kind === 'folder';
    return (
      <Dialog open onOpenChange={(o) => !o && close()}>
        <DialogContent
          title={`Delete ${state.entry.path.split('/').pop()}?`}
          description={
            isFolder
              ? 'The folder and everything in it will be deleted for everyone. This can’t be undone.'
              : 'The file will be deleted for everyone. This can’t be undone.'
          }
        >
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button
              variant="danger"
              disabled={del.isPending}
              onClick={() =>
                del.mutate(state.entry.id, {
                  onSuccess: () => {
                    toast.success(`Deleted ${state.entry.path}`);
                    close();
                  },
                })
              }
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const isCreate = state?.mode === 'create';
  const title = !state
    ? ''
    : isCreate
      ? state.kind === 'file'
        ? 'New file'
        : 'New folder'
      : 'Rename or move';
  const defaultValue = !state
    ? ''
    : isCreate
      ? state.parent
        ? `${state.parent}/`
        : ''
      : state.entry.path;

  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && close()}>
      {state && (
        <DialogContent
          title={title}
          description="Use slashes for folders, e.g. src/components/Button.tsx. Missing folders are created for you."
        >
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <Field id="file-path" label="Path" error={error}>
              <Input
                id="file-path"
                name="path"
                defaultValue={defaultValue}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                className="font-mono text-[13px]"
                aria-invalid={!!error}
                onFocus={(e) => {
                  // Select just the name part, like desktop editors do.
                  const v = e.currentTarget.value;
                  const start = v.lastIndexOf('/') + 1;
                  const dot = v.lastIndexOf('.');
                  e.currentTarget.setSelectionRange(start, dot > start ? dot : v.length);
                }}
              />
            </Field>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={create.isPending || move.isPending}>
                {isCreate ? 'Create' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
