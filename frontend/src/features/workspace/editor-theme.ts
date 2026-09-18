import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

/** Editor chrome built from the app's theme tokens, so light/dark switch automatically. */
const chrome = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'var(--surface)',
    color: 'var(--ink)',
    fontSize: '13px',
  },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6' },
  '.cm-content': { caretColor: 'var(--cobalt)', padding: '12px 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--cobalt)', borderLeftWidth: '2px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-gutters': {
    backgroundColor: 'var(--surface)',
    color: 'color-mix(in oklab, var(--ink-muted) 70%, transparent)',
    border: 'none',
  },
  '.cm-activeLine': { backgroundColor: 'color-mix(in oklab, var(--surface-2) 55%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--ink)' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection':
    { backgroundColor: 'color-mix(in oklab, var(--cobalt) 22%, transparent) !important' },
  '.cm-matchingBracket': {
    backgroundColor: 'color-mix(in oklab, var(--teal) 25%, transparent)',
    outline: 'none',
  },
  '.cm-searchMatch': { backgroundColor: 'color-mix(in oklab, var(--marigold) 35%, transparent)' },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--surface-2)',
    border: 'none',
    color: 'var(--ink-muted)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--line)',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--surface-2)',
    color: 'var(--ink)',
  },
  '.cm-panels': { backgroundColor: 'var(--surface-2)', color: 'var(--ink)' },
  // Collaborator name tags above remote cursors (from y-codemirror).
  '.cm-ySelectionInfo': {
    fontFamily: 'var(--font-sans)',
    fontWeight: '600',
    fontSize: '10px',
    padding: '1px 4px',
    borderRadius: '3px 3px 3px 0',
    color: '#1b2233',
    opacity: '1',
  },
});

const highlight = HighlightStyle.define([
  {
    tag: [t.keyword, t.modifier, t.operatorKeyword, t.controlKeyword],
    color: 'var(--syn-keyword)',
  },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--syn-string)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--syn-number)' },
  {
    tag: [t.comment, t.lineComment, t.blockComment],
    color: 'var(--syn-comment)',
    fontStyle: 'italic',
  },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--syn-function)' },
  { tag: [t.typeName, t.className, t.namespace, t.tagName], color: 'var(--syn-type)' },
  { tag: [t.propertyName, t.attributeName], color: 'var(--syn-property)' },
  { tag: [t.heading], fontWeight: '700', color: 'var(--syn-keyword)' },
  { tag: t.link, textDecoration: 'underline' },
  { tag: t.invalid, color: 'var(--syn-invalid)' },
]);

export const editorTheme = [chrome, syntaxHighlighting(highlight)];
