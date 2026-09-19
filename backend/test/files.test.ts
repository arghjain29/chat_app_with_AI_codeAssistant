import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { FILE_TEXT_KEY, fileDocName, projectDocName } from '@codecollab/shared';
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FileModel } from '../src/modules/files/file.model.js';
import { textFromState } from '../src/modules/files/yjs.js';
import { attachCollab, collab, COLLAB_PATH, notifyProject } from '../src/realtime/collab.js';
import { app, createProject, invite, signUp } from './helpers.js';

const P = '/api/v1/projects';

async function team() {
  const alice = await signUp('alice');
  const bob = await signUp('bob');
  const vera = await signUp('vera');
  const mallory = await signUp('mallory');
  const { id } = await createProject(alice.client);
  const ed = await invite(alice.client, id, { role: 'editor' });
  await bob.client.post(`/api/v1/invites/${ed.token}/accept`).expect(200);
  const vi = await invite(alice.client, id, { role: 'viewer' });
  await vera.client.post(`/api/v1/invites/${vi.token}/accept`).expect(200);
  return { alice, bob, vera, mallory, id };
}

describe('file tree', () => {
  it('starts new projects with the starter files, or none for blank', async () => {
    const alice = await signUp('alice');
    const { id } = await createProject(alice.client);
    const files = await alice.client.get(`${P}/${id}/files`).expect(200);
    expect(files.body.map((f: { path: string }) => f.path)).toEqual([
      'README.md',
      'index.html',
      'script.js',
      'style.css',
    ]);

    const blank = await alice.client.post(P, { name: 'Empty', template: 'blank' }).expect(201);
    const none = await alice.client.get(`${P}/${blank.body.id}/files`).expect(200);
    expect(none.body).toEqual([]);
  });

  it('creates missing parent folders and returns content in the snapshot', async () => {
    const { bob, id } = await team();
    await bob.client
      .post(`${P}/${id}/files`, { path: 'src/lib/util.js', content: 'export const x = 1;' })
      .expect(201);

    const files = await bob.client.get(`${P}/${id}/files`).expect(200);
    const byPath = Object.fromEntries(
      files.body.map((f: { path: string; kind: string }) => [f.path, f.kind]),
    );
    expect(byPath).toMatchObject({ src: 'folder', 'src/lib': 'folder', 'src/lib/util.js': 'file' });

    const snap = await bob.client.get(`${P}/${id}/files/snapshot`).expect(200);
    expect(snap.body).toContainEqual({ path: 'src/lib/util.js', content: 'export const x = 1;' });
  });

  it('rejects unsafe paths, duplicates, and files inside files', async () => {
    const { bob, id } = await team();
    for (const path of ['../escape.js', '/abs.js', 'a/../../b']) {
      await bob.client.post(`${P}/${id}/files`, { path }).expect(400);
    }
    await bob.client.post(`${P}/${id}/files`, { path: 'index.html' }).expect(409);
    await bob.client.post(`${P}/${id}/files`, { path: 'script.js/inner.js' }).expect(400);
  });

  it('moves folders with their contents and refuses moving a folder into itself', async () => {
    const { bob, id } = await team();
    const folder = await bob.client
      .post(`${P}/${id}/files`, { path: 'src', kind: 'folder' })
      .expect(201);
    await bob.client.post(`${P}/${id}/files`, { path: 'src/a.js' }).expect(201);

    await bob.client.patch(`${P}/${id}/files/${folder.body.id}`, { path: 'src/inner' }).expect(400);
    await bob.client.patch(`${P}/${id}/files/${folder.body.id}`, { path: 'lib' }).expect(200);

    const paths = (await bob.client.get(`${P}/${id}/files`)).body.map(
      (f: { path: string }) => f.path,
    );
    expect(paths).toContain('lib/a.js');
    expect(paths).not.toContain('src/a.js');
  });

  it('deletes a folder and everything in it', async () => {
    const { bob, id } = await team();
    const folder = await bob.client
      .post(`${P}/${id}/files`, { path: 'src', kind: 'folder' })
      .expect(201);
    await bob.client.post(`${P}/${id}/files`, { path: 'src/deep/a.js' }).expect(201);
    await bob.client.delete(`${P}/${id}/files/${folder.body.id}`).expect(204);
    expect(await FileModel.countDocuments({ projectId: id, path: /^src/ })).toBe(0);
  });

  it('lets viewers read but not change files, and hides files from outsiders', async () => {
    const { vera, mallory, id } = await team();
    await vera.client.get(`${P}/${id}/files`).expect(200);
    await vera.client.get(`${P}/${id}/files/snapshot`).expect(200);
    await vera.client.post(`${P}/${id}/files`, { path: 'x.js' }).expect(403);

    await mallory.client.get(`${P}/${id}/files`).expect(404);
    await mallory.client.get(`${P}/${id}/files/snapshot`).expect(404);
  });

  it('removes files when the project is deleted', async () => {
    const { alice, id } = await team();
    await alice.client.delete(`${P}/${id}`).expect(204);
    expect(await FileModel.countDocuments({ projectId: id })).toBe(0);
  });
});

describe('live collaboration', () => {
  let server: Server;
  let url: string;

  beforeAll(async () => {
    server = createServer(app);
    attachCollab(server);
    await new Promise<void>((r) => server.listen(0, r));
    url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}${COLLAB_PATH}`;
  });

  afterAll(async () => {
    collab.closeConnections();
    await new Promise((r) => server.close(r));
  });

  /** Connect to a document; resolves once synced, or with the failure reason. */
  function connect(name: string, token: string) {
    return new Promise<{ provider: HocuspocusProvider; ok: boolean }>((resolve) => {
      const provider = new HocuspocusProvider({
        url,
        name,
        token,
        onSynced: () => resolve({ provider, ok: true }),
        onAuthenticationFailed: () => resolve({ provider, ok: false }),
      });
    });
  }

  const fileId = async (projectId: string, path: string) =>
    (await FileModel.findOne({ projectId, path }))!.id as string;

  const waitFor = async (check: () => boolean | Promise<boolean>) => {
    for (let i = 0; i < 50; i++) {
      if (await check()) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error('Timed out waiting for condition');
  };

  it('syncs edits between members and saves them', async () => {
    const { id } = await team();
    const doc = fileDocName(await fileId(id, 'script.js'));

    const a = await connect(doc, 'alice');
    const b = await connect(doc, 'bob');
    expect(a.ok && b.ok).toBe(true);
    expect(b.provider.document.getText(FILE_TEXT_KEY).toString()).toContain('counter');

    a.provider.document.getText(FILE_TEXT_KEY).insert(0, '// hello\n');
    await waitFor(() =>
      b.provider.document.getText(FILE_TEXT_KEY).toString().startsWith('// hello'),
    );

    collab.flushPendingStores();
    await waitFor(async () => {
      const f = await FileModel.findOne({ projectId: id, path: 'script.js' }).select('+yjsState');
      return textFromState(f?.yjsState).startsWith('// hello');
    });

    a.provider.destroy();
    b.provider.destroy();
  });

  it('keeps viewers read-only', async () => {
    const { id } = await team();
    const doc = fileDocName(await fileId(id, 'script.js'));
    const v = await connect(doc, 'vera');
    const b = await connect(doc, 'bob');
    expect(v.ok).toBe(true);

    v.provider.document.getText(FILE_TEXT_KEY).insert(0, 'HACKED ');
    await new Promise((r) => setTimeout(r, 300));
    expect(b.provider.document.getText(FILE_TEXT_KEY).toString()).not.toContain('HACKED');
    expect(collab.documents.get(doc)!.getText(FILE_TEXT_KEY).toString()).not.toContain('HACKED');

    v.provider.destroy();
    b.provider.destroy();
  });

  it('keeps syncing when a document is closed and reopened on a shared socket', async () => {
    // The browser multiplexes every document over one socket, and React (in development)
    // opens, closes and reopens each one on mount. This is the client setup the app uses.
    const { id } = await team();
    const doc = fileDocName(await fileId(id, 'script.js'));
    const open = (socket: HocuspocusProviderWebsocket, name: string, token: string, extra = {}) => {
      const p = new HocuspocusProvider({
        websocketProvider: socket,
        name,
        token,
        sessionAwareness: true,
        ...extra,
      });
      p.attach();
      return p;
    };
    const aSocket = new HocuspocusProviderWebsocket({ url });
    const bSocket = new HocuspocusProviderWebsocket({ url });
    let event = '';

    open(aSocket, doc, 'alice').destroy();
    open(bSocket, doc, 'bob').destroy();
    open(bSocket, projectDocName(id), 'bob').destroy();
    const a = open(aSocket, doc, 'alice');
    const b = open(bSocket, doc, 'bob');
    const room = open(bSocket, projectDocName(id), 'bob', {
      onStateless: ({ payload }: { payload: string }) => (event = payload),
    });

    await waitFor(() => a.isSynced && b.isSynced && room.isSynced);
    a.document.getText(FILE_TEXT_KEY).insert(0, 'LIVE ');
    await waitFor(() => b.document.getText(FILE_TEXT_KEY).toString().startsWith('LIVE '));
    notifyProject(id, { type: 'files-changed' });
    await waitFor(() => event.includes('files-changed'));

    for (const p of [a, b, room]) p.destroy();
    aSocket.destroy();
    bSocket.destroy();
  });

  it('refuses outsiders, bad tokens and unknown documents', async () => {
    const { id } = await team();
    const doc = fileDocName(await fileId(id, 'script.js'));

    const outsider = await connect(doc, 'mallory');
    const badToken = await connect(doc, 'bad');
    const unknown = await connect('file:0123456789abcdef01234567', 'alice');
    expect([outsider.ok, badToken.ok, unknown.ok]).toEqual([false, false, false]);

    for (const c of [outsider, badToken, unknown]) c.provider.destroy();
  });
});
