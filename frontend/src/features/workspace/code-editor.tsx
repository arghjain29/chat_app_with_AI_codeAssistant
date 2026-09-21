import { FILE_TEXT_KEY, fileDocName, type Me } from '@codecollab/shared';
import { indentWithTab } from '@codemirror/commands';
import { LanguageDescription } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { yCollab } from 'y-codemirror.next';
import * as Y from 'yjs';
import { presenceHex } from '@/components/ui/avatar';
import { openDocument } from '@/lib/collab';
import { editorTheme } from './editor-theme';

type Status = 'connecting' | 'ready' | 'denied';

/** Wrapping is on unless this person turned it off (Alt+Z), on any file, in any session. */
const WRAP_KEY = 'codecollab:wrap-lines';
const storedWrap = () => {
  try {
    return localStorage.getItem(WRAP_KEY) !== 'false';
  } catch {
    return true; // Storage blocked (private windows): fall back to the default.
  }
};

/**
 * A collaborative editor for one file. Everyone with the file open edits the same
 * Yjs document; their cursors and selections appear with their name and colour.
 */
export function CodeEditor({
  fileId,
  path,
  readOnly,
  me,
  onChange,
}: {
  fileId: string;
  path: string;
  readOnly: boolean;
  me: Me;
  /** Called with the full text after any edit, local or from a collaborator. */
  onChange?: (text: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const view = useRef<EditorView | null>(null);
  const language = useRef(new Compartment());
  const wrapping = useRef(new Compartment());
  const [status, setStatus] = useState<Status>('connecting');
  const [wrap, setWrap] = useState(storedWrap);
  // The keymap is built once, so it reads the current setting from here rather than closing over it.
  const wrapNow = useRef(wrap);
  useEffect(() => {
    wrapNow.current = wrap;
  });

  useEffect(() => {
    const provider = openDocument(fileDocName(fileId), {
      onSynced: () => setStatus('ready'),
      onAuthenticationFailed: () => setStatus('denied'),
    });
    const color = presenceHex(me.id);
    provider.setAwarenessField('user', { name: me.username, color, colorLight: `${color}33` });

    const ytext = provider.document.getText(FILE_TEXT_KEY);
    const undoManager = new Y.UndoManager(ytext);
    const notify = () => onChangeRef.current?.(ytext.toString());
    ytext.observe(notify);

    const editor = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: ytext.toString(),
        extensions: [
          basicSetup,
          keymap.of([
            indentWithTab,
            {
              key: 'Alt-z',
              preventDefault: true,
              run: () => {
                const next = !wrapNow.current;
                setWrap(next);
                toast(next ? 'Lines wrap' : 'Lines scroll sideways', { id: 'wrap' });
                return true;
              },
            },
            {
              key: 'Mod-s',
              preventDefault: true,
              run: () => {
                toast('Changes save automatically', { id: 'autosave' });
                return true;
              },
            },
          ]),
          language.current.of([]),
          wrapping.current.of(wrapNow.current ? EditorView.lineWrapping : []),
          editorTheme,
          EditorState.readOnly.of(readOnly),
          EditorView.contentAttributes.of({ 'aria-label': `Code editor: ${path}` }),
          yCollab(ytext, provider.awareness, { undoManager }),
        ],
      }),
    });
    view.current = editor;

    return () => {
      view.current = null;
      ytext.unobserve(notify);
      editor.destroy();
      undoManager.destroy();
      provider.destroy();
      setStatus('connecting');
    };
    // `path` only affects the language (handled below) and the aria label.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, readOnly, me.id, me.username]);

  // Apply the wrap setting to the open editor, and remember it for the next file and session.
  useEffect(() => {
    view.current?.dispatch({
      effects: wrapping.current.reconfigure(wrap ? EditorView.lineWrapping : []),
    });
    try {
      localStorage.setItem(WRAP_KEY, String(wrap));
    } catch {
      // Nothing to remember it in; the setting still applies for this session.
    }
  }, [wrap]);

  // Load syntax support for the file type on demand (works for most languages).
  useEffect(() => {
    let cancelled = false;
    const desc = LanguageDescription.matchFilename(languages, path.split('/').pop() ?? path);
    const apply = (ext: Parameters<Compartment['reconfigure']>[0]) =>
      view.current?.dispatch({ effects: language.current.reconfigure(ext) });
    if (!desc) apply([]);
    else void desc.load().then((support) => !cancelled && apply(support));
    return () => {
      cancelled = true;
    };
  }, [path, fileId, readOnly]);

  return (
    <div className="relative h-full min-h-0">
      <div ref={host} className="h-full" />
      {status !== 'ready' && (
        <div className="absolute inset-0 grid place-items-center bg-surface">
          {status === 'denied' ? (
            <p className="max-w-xs text-center text-sm text-ink-muted">
              You no longer have access to this file. It may have been deleted, or your role
              changed.
            </p>
          ) : (
            <div className="w-2/3 max-w-md space-y-2" aria-busy="true" aria-label="Opening file">
              {[70, 90, 55, 80].map((w) => (
                <div
                  key={w}
                  className="h-3 animate-pulse rounded bg-surface-2"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
