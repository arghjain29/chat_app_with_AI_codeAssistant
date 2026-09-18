import type { FileSnapshot } from '@codecollab/shared';
import { WebContainer, type FileSystemTree, type WebContainerProcess } from '@webcontainer/api';
import type { Runtime } from './runtime';

/**
 * Runs projects inside WebContainer (Node.js in the browser). Only one WebContainer
 * can exist per page, so it's booted once and reused across projects.
 */

let booting: Promise<WebContainer> | null = null;
let listeners = new Set<(url: string) => void>();

/** WebContainer needs a cross-origin isolated page (Chrome, Edge, Firefox; not Safari yet). */
export const runtimeSupported = () => typeof window !== 'undefined' && window.crossOriginIsolated;

function container(): Promise<WebContainer> {
  booting ??= WebContainer.boot({ coep: 'credentialless', workdirName: 'project' }).then((wc) => {
    wc.on('server-ready', (_port, url) => listeners.forEach((l) => l(url)));
    return wc;
  });
  return booting;
}

/** Static file server for plain HTML/CSS/JS projects; needs no npm install. */
const STATIC_SERVER = `
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.txt': 'text/plain', '.md': 'text/plain', '.wasm': 'application/wasm' };
const root = process.cwd();

createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([\\\\/])+/, '');
  let file = join(root, path);
  try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); } catch {}
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': (TYPES[extname(file)] ?? 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found: /' + path);
  }
}).listen(4321, () => console.log('Serving on port 4321'));
`;

const SERVER_FILE = '.codecollab-serve.mjs';

function toTree(files: FileSnapshot[]): FileSystemTree {
  const tree: FileSystemTree = {};
  for (const { path, content } of files) {
    const parts = path.split('/');
    let dir = tree;
    for (const part of parts.slice(0, -1)) {
      const next = (dir[part] ??= { directory: {} });
      if (!('directory' in next)) break; // A file where a folder should be: skip.
      dir = next.directory;
    }
    dir[parts[parts.length - 1]!] = { file: { contents: content } };
  }
  return tree;
}

/** Remove the previous run's files, keeping node_modules so reinstalls are fast. */
async function clearWorkdir(wc: WebContainer) {
  for (const name of await wc.fs.readdir('.')) {
    if (name !== 'node_modules') await wc.fs.rm(name, { recursive: true, force: true });
  }
}

export interface RunCallbacks {
  onOutput: (text: string) => void;
  onStatus: (status: 'installing' | 'starting' | 'running' | 'exited', detail?: string) => void;
  onPreview: (url: string) => void;
}

export class ProjectRun {
  private process: WebContainerProcess | null = null;
  private stopped = false;
  private wc: WebContainer | null = null;
  private previewListener: ((url: string) => void) | null = null;

  constructor(
    private readonly runtime: Exclude<Runtime, { kind: 'unsupported' }>,
    private readonly cb: RunCallbacks,
  ) {}

  async start(files: FileSnapshot[], size: { cols: number; rows: number }) {
    const wc = (this.wc = await container());
    this.previewListener = (url) => !this.stopped && this.cb.onPreview(url);
    listeners.add(this.previewListener);

    await clearWorkdir(wc);
    await wc.mount(toTree(files));

    if (this.runtime.kind === 'npm') {
      this.cb.onStatus('installing');
      const install = await this.spawn('npm', ['install'], size);
      const code = await install.exit;
      if (this.stopped) return;
      if (code !== 0) {
        this.cb.onStatus('exited', `npm install failed (exit code ${code})`);
        return;
      }
      await this.watch(this.spawn('npm', ['run', this.runtime.script], size));
    } else if (this.runtime.kind === 'static') {
      await wc.fs.writeFile(SERVER_FILE, STATIC_SERVER);
      await this.watch(this.spawn('node', [SERVER_FILE], size));
    } else {
      await this.watch(this.spawn('node', [this.runtime.entry], size));
    }
  }

  private async spawn(cmd: string, args: string[], size: { cols: number; rows: number }) {
    this.cb.onOutput(`\x1b[2m$ ${cmd} ${args.join(' ')}\x1b[0m\r\n`);
    const proc = await this.wc!.spawn(cmd, args, { terminal: size });
    this.process = proc;
    void proc.output.pipeTo(new WritableStream({ write: (d) => this.cb.onOutput(d) }));
    return proc;
  }

  private async watch(procPromise: Promise<WebContainerProcess>) {
    const proc = await procPromise;
    if (this.stopped) return proc.kill();
    this.cb.onStatus(this.runtime.kind === 'node' ? 'running' : 'starting');
    const code = await proc.exit;
    if (!this.stopped) this.cb.onStatus('exited', `Process exited with code ${code}`);
  }

  /** Forward keystrokes from the terminal to the running process. */
  async input(data: string) {
    const writer = this.process?.input.getWriter();
    if (!writer) return;
    await writer.write(data);
    writer.releaseLock();
  }

  resize(size: { cols: number; rows: number }) {
    this.process?.resize(size);
  }

  /** Update one file while running (live edits); dev servers pick it up themselves. */
  async writeFile(path: string, content: string) {
    if (this.stopped || !this.wc) return;
    const dir = path.split('/').slice(0, -1).join('/');
    if (dir) await this.wc.fs.mkdir(dir, { recursive: true });
    await this.wc.fs.writeFile(path, content);
  }

  stop() {
    this.stopped = true;
    this.process?.kill();
    if (this.previewListener) listeners.delete(this.previewListener);
  }
}

// Keep the listener set stable across hot reloads in development.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    listeners = new Set();
  });
}
