import { FILE_TEXT_KEY } from '@codecollab/shared';
import * as Y from 'yjs';

/** Encode plain text as a fresh Yjs document state. */
export function stateFromText(text: string): Buffer {
  const doc = new Y.Doc();
  doc.getText(FILE_TEXT_KEY).insert(0, text);
  const state = Buffer.from(Y.encodeStateAsUpdate(doc));
  doc.destroy();
  return state;
}

/** Read the text out of a stored Yjs state. */
export function textFromState(state: Uint8Array | null | undefined): string {
  if (!state || state.length === 0) return '';
  const doc = new Y.Doc();
  Y.applyUpdate(doc, state);
  const text = doc.getText(FILE_TEXT_KEY).toString();
  doc.destroy();
  return text;
}
