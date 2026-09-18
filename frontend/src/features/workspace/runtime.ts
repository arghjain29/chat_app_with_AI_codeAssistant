import type { FileSnapshot } from '@codecollab/shared';

/** How (or whether) a project can run in the browser. */
export type Runtime =
  | { kind: 'npm'; script: string; label: string }
  | { kind: 'static'; label: string }
  | { kind: 'node'; entry: string; label: string }
  | { kind: 'unsupported'; reason: string };

const NODE_ENTRIES = ['index.js', 'main.js', 'server.js', 'app.js', 'index.mjs', 'main.mjs'];

/** Languages we can edit together but not run in the browser, by file extension. */
const OTHER_LANGUAGES: Record<string, string> = {
  py: 'Python',
  java: 'Java',
  go: 'Go',
  rs: 'Rust',
  rb: 'Ruby',
  php: 'PHP',
  cs: 'C#',
  cpp: 'C++',
  cc: 'C++',
  c: 'C',
  kt: 'Kotlin',
  swift: 'Swift',
  dart: 'Dart',
  scala: 'Scala',
  ex: 'Elixir',
  hs: 'Haskell',
  lua: 'Lua',
  r: 'R',
};

const EDIT_ONLY =
  'You can still edit it together; only JavaScript and Node.js projects run in the browser.';

/**
 * Decide how to run a project, in order of preference:
 * a package.json script, a static site, a single Node file. Everything else is edit-only.
 */
export function detectRuntime(files: FileSnapshot[]): Runtime {
  const byPath = new Map(files.map((f) => [f.path, f.content]));

  const pkgText = byPath.get('package.json');
  if (pkgText !== undefined) {
    let scripts: Record<string, unknown>;
    try {
      scripts = (JSON.parse(pkgText) as { scripts?: Record<string, unknown> }).scripts ?? {};
    } catch {
      return {
        kind: 'unsupported',
        reason: 'package.json isn’t valid JSON. Fix it to run the project.',
      };
    }
    for (const script of ['dev', 'start']) {
      if (typeof scripts[script] === 'string') {
        return { kind: 'npm', script, label: `npm run ${script}` };
      }
    }
    return {
      kind: 'unsupported',
      reason: 'Add a "dev" or "start" script to package.json to run this project.',
    };
  }

  if (byPath.has('index.html')) return { kind: 'static', label: 'Static site' };

  const entry = NODE_ENTRIES.find((e) => byPath.has(e));
  if (entry) return { kind: 'node', entry, label: `node ${entry}` };

  // Name the language if it's clearly something else.
  const counts = new Map<string, number>();
  for (const f of files) {
    const lang = OTHER_LANGUAGES[f.path.split('.').pop()?.toLowerCase() ?? ''];
    if (lang) counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (top)
    return {
      kind: 'unsupported',
      reason: `${top} projects can’t run in the browser. ${EDIT_ONLY}`,
    };

  if (files.length === 0)
    return { kind: 'unsupported', reason: 'Add some files to run the project.' };
  return {
    kind: 'unsupported',
    reason: `Nothing to run yet. Add an index.html, a package.json with a "dev" or "start" script, or an index.js. ${EDIT_ONLY}`,
  };
}
