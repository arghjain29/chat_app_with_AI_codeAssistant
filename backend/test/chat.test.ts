import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MessageModel } from '../src/modules/chat/message.model.js';
import { createProject, invite, signUp } from './helpers.js';

const P = '/api/v1/projects';
type Client = Awaited<ReturnType<typeof signUp>>['client'];

async function room() {
  const alice = await signUp('alice');
  const bob = await signUp('bob');
  const vera = await signUp('vera');
  const mallory = await signUp('mallory');
  const { id } = await createProject(alice.client);
  const ed = await invite(alice.client, id, { role: 'editor' });
  await bob.client.post(`/api/v1/invites/${ed.token}/accept`).expect(200);
  const vi = await invite(alice.client, id, { role: 'viewer' });
  await vera.client.post(`/api/v1/invites/${vi.token}/accept`).expect(200);
  return { alice, bob, vera, mallory, id, url: `${P}/${id}/messages` };
}

const send = (client: Client, url: string, content: string, extra: object = {}) =>
  client.post(url, { content, clientId: randomUUID(), ...extra });

describe('sending and reading messages', () => {
  it('stores messages with the server-side author, oldest first', async () => {
    const { alice, bob, url } = await room();
    await send(alice.client, url, 'first').expect(201);
    const res = await send(bob.client, url, 'second', { author: 'alice' }).expect(201);
    expect(res.body.author.username).toBe('bob'); // A spoofed author is ignored.

    const page = await alice.client.get(url).expect(200);
    expect(page.body.items.map((m: { content: string }) => m.content)).toEqual(['first', 'second']);
    expect(page.body.nextCursor).toBeNull();
  });

  it('lets viewers chat, but hides the chat from outsiders', async () => {
    const { vera, mallory, url } = await room();
    await send(vera.client, url, 'hi from a viewer').expect(201);
    await mallory.client.get(url).expect(404);
    await send(mallory.client, url, 'let me in').expect(404);
  });

  it('pages backwards through history', async () => {
    const { alice, url } = await room();
    for (let i = 0; i < 5; i++) await send(alice.client, url, `m${i}`).expect(201);

    const newest = await alice.client.get(`${url}?limit=2`).expect(200);
    expect(newest.body.items.map((m: { content: string }) => m.content)).toEqual(['m3', 'm4']);
    const older = await alice.client
      .get(`${url}?limit=2&before=${newest.body.nextCursor}`)
      .expect(200);
    expect(older.body.items.map((m: { content: string }) => m.content)).toEqual(['m1', 'm2']);
  });

  it('rejects empty and oversized messages', async () => {
    const { alice, url } = await room();
    await send(alice.client, url, '   ').expect(400);
    await send(alice.client, url, 'x'.repeat(4001)).expect(400);
  });

  it('treats a repeated client id as the same message', async () => {
    const { alice, url } = await room();
    const clientId = randomUUID();
    const a = await alice.client.post(url, { content: 'once', clientId }).expect(201);
    const b = await alice.client.post(url, { content: 'once', clientId }).expect(201);
    expect(b.body.id).toBe(a.body.id);
    expect(await MessageModel.countDocuments()).toBe(1);
  });

  it('limits how fast one person can send', async () => {
    const { bob, url } = await room();
    for (let i = 0; i < 10; i++) await send(bob.client, url, `spam ${i}`).expect(201);
    const res = await send(bob.client, url, 'one more').expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('threads, mentions and reactions', () => {
  it('keeps replies in a thread and counts them on the root', async () => {
    const { alice, bob, url } = await room();
    const root = await send(alice.client, url, 'Should we use Vite?').expect(201);
    await send(bob.client, url, 'Yes', { parentId: root.body.id }).expect(201);
    await send(alice.client, url, 'Great', { parentId: root.body.id }).expect(201);

    const main = await alice.client.get(url).expect(200);
    expect(main.body.items).toHaveLength(1);
    expect(main.body.items[0]).toMatchObject({ replyCount: 2 });

    const thread = await bob.client.get(`${url}/${root.body.id}/thread`).expect(200);
    expect(thread.body.replies.map((r: { content: string }) => r.content)).toEqual([
      'Yes',
      'Great',
    ]);
  });

  it('resolves mentions of members only', async () => {
    const { alice, bob, url } = await room();
    const res = await send(alice.client, url, 'hey @bob and @mallory').expect(201);
    expect(res.body.mentions).toEqual([bob.id]);
  });

  it('toggles reactions and only allows the known set', async () => {
    const { alice, bob, url } = await room();
    const msg = await send(alice.client, url, 'shipped!').expect(201);
    const r1 = await bob.client
      .post(`${url}/${msg.body.id}/reactions`, { emoji: '🎉' })
      .expect(200);
    expect(r1.body.reactions).toEqual([{ emoji: '🎉', userIds: [bob.id] }]);
    const r2 = await bob.client
      .post(`${url}/${msg.body.id}/reactions`, { emoji: '🎉' })
      .expect(200);
    expect(r2.body.reactions).toEqual([]);
    await bob.client.post(`${url}/${msg.body.id}/reactions`, { emoji: '💩' }).expect(400);
  });
});

describe('editing and deleting', () => {
  it('lets only the author edit', async () => {
    const { alice, bob, url } = await room();
    const msg = await send(bob.client, url, 'typo').expect(201);
    await alice.client.patch(`${url}/${msg.body.id}`, { content: 'nope' }).expect(403);
    const res = await bob.client.patch(`${url}/${msg.body.id}`, { content: 'fixed' }).expect(200);
    expect(res.body).toMatchObject({ content: 'fixed', editedAt: expect.any(String) });
  });

  it('lets authors and the owner delete, clearing the content', async () => {
    const { alice, bob, vera, url } = await room();
    const msg = await send(bob.client, url, 'oops').expect(201);
    await vera.client.delete(`${url}/${msg.body.id}`).expect(403);
    const res = await alice.client.delete(`${url}/${msg.body.id}`).expect(200);
    expect(res.body).toMatchObject({ content: '', deletedAt: expect.any(String) });
    await bob.client.patch(`${url}/${msg.body.id}`, { content: 'back' }).expect(404);
  });
});

describe('unread counts', () => {
  it('counts others’ messages since the last read', async () => {
    const { alice, bob, id, url } = await room();
    await send(alice.client, url, 'one').expect(201);
    await send(alice.client, url, 'two').expect(201);

    const unread = async (c: Client) =>
      (await c.get(`${P}/${id}`).expect(200)).body.unreadCount as number;
    expect(await unread(bob.client)).toBe(2);
    expect(await unread(alice.client)).toBe(0); // Your own messages don't count.

    await bob.client.post(`${url}/read`).expect(204);
    expect(await unread(bob.client)).toBe(0);

    await send(alice.client, url, 'three').expect(201);
    const list = await bob.client.get(P).expect(200);
    expect(list.body[0].unreadCount).toBe(1);
  });

  it('deletes chat along with the project', async () => {
    const { alice, id, url } = await room();
    await send(alice.client, url, 'bye').expect(201);
    await alice.client.delete(`${P}/${id}`).expect(204);
    expect(await MessageModel.countDocuments({ projectId: id })).toBe(0);
  });
});
