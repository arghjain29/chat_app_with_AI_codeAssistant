import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { setProvidersForTesting } from '../src/ai/models.js';
import {
  ProviderError,
  type AiRequest,
  type AiResult,
  type Provider,
} from '../src/ai/providers.js';
import { DailySpendModel, UsageModel } from '../src/ai/usage.js';
import { MessageModel } from '../src/modules/chat/message.model.js';
import { FileModel } from '../src/modules/files/file.model.js';
import { textFromState } from '../src/modules/files/yjs.js';
import { createProject, invite, signUp } from './helpers.js';

const P = '/api/v1/projects';

type Handler = (req: AiRequest, call: number) => Promise<AiResult> | AiResult;

/** A fake Gemini whose behaviour each test scripts; `calls` records the models tried. */
function fakeGemini(handler: Handler) {
  const calls: string[] = [];
  const provider: Provider = {
    id: 'gemini',
    async stream(req) {
      calls.push(req.model);
      return handler(req, calls.length);
    },
  };
  setProvidersForTesting({ gemini: provider });
  return calls;
}

const answer =
  (text: string, toolInput: unknown = null): Handler =>
  (req) => {
    for (const word of text.split(/(?<= )/)) req.onText(word);
    return { toolInput, inputTokens: 100, outputTokens: 20 };
  };

afterEach(() => setProvidersForTesting(null));

async function team() {
  const alice = await signUp('alice');
  const vera = await signUp('vera');
  const { id } = await createProject(alice.client);
  const vi = await invite(alice.client, id, { role: 'viewer' });
  await vera.client.post(`/api/v1/invites/${vi.token}/accept`).expect(200);
  return { alice, vera, id, url: `${P}/${id}/messages` };
}

const ask = (client: Awaited<ReturnType<typeof signUp>>['client'], url: string, content: string) =>
  client.post(url, { content, clientId: randomUUID() });

async function finishedAnswer() {
  for (let i = 0; i < 100; i++) {
    const doc = await MessageModel.findOne({ kind: 'ai', 'ai.status': { $ne: 'streaming' } });
    if (doc) return doc;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('AI never finished');
}

describe('asking the AI', () => {
  it('answers @ai messages and counts the request', async () => {
    fakeGemini(answer('Use a Map for O(1) lookups.'));
    const { alice, url } = await team();

    await ask(alice.client, url, '@ai how do I dedupe this list?').expect(201);
    const doc = await finishedAnswer();
    expect(doc.content).toBe('Use a Map for O(1) lookups.');
    expect(doc.ai).toMatchObject({ status: 'done', model: 'Gemini 3.5 Flash-Lite' });

    const usage = await alice.client.get('/api/v1/users/me/usage').expect(200);
    expect(usage.body.aiRequests).toMatchObject({ used: 1, limit: 30, period: 'day' });
  });

  it('ignores messages that don’t mention @ai', async () => {
    const calls = fakeGemini(answer('nope'));
    const { alice, url } = await team();
    await ask(alice.client, url, 'email me at ai@example.com').expect(201);
    await new Promise((r) => setTimeout(r, 100));
    expect(calls).toHaveLength(0);
    expect(await MessageModel.countDocuments({ kind: 'ai' })).toBe(0);
  });

  it('falls back to the next model when one is unavailable', async () => {
    const calls = fakeGemini((req, call) => {
      if (call === 1) throw new ProviderError('overloaded', true);
      return answer('From the backup model.')(req, call);
    });
    const { alice, url } = await team();
    await ask(alice.client, url, '@ai hi').expect(201);
    const doc = await finishedAnswer();
    expect(calls).toEqual(['gemini-3.5-flash-lite', 'gemini-3.8-flash']);
    expect(doc.ai.model).toBe('Gemini 3.8 Flash');
  });

  it('refunds the request when no model can answer', async () => {
    fakeGemini(() => {
      throw new ProviderError('down', true);
    });
    const { alice, url } = await team();
    await ask(alice.client, url, '@ai hi').expect(201);
    const doc = await finishedAnswer();
    expect(doc.ai.status).toBe('error');
    const usage = await alice.client.get('/api/v1/users/me/usage').expect(200);
    expect(usage.body.aiRequests.used).toBe(0);
  });
});

describe('AI limits', () => {
  it('refuses viewers without posting their message', async () => {
    fakeGemini(answer('x'));
    const { vera, url } = await team();
    await ask(vera.client, url, '@ai help').expect(403);
    expect(await MessageModel.countDocuments()).toBe(0);
  });

  it('stops at the plan quota', async () => {
    fakeGemini(answer('x'));
    const { alice, url } = await team();
    const day = new Date().toISOString().slice(0, 10);
    await UsageModel.create({ userId: alice.id, period: day, aiRequests: 30 });

    const res = await ask(alice.client, url, '@ai one more').expect(402);
    expect(res.body.error.details).toMatchObject({ limit: 'aiRequests' });
    expect(await MessageModel.countDocuments()).toBe(0);
  });

  it('pauses everyone once the daily spending cap is reached', async () => {
    fakeGemini(answer('x'));
    const { alice, url } = await team();
    await DailySpendModel.create({ day: new Date().toISOString().slice(0, 10), costMicros: 9e9 });
    const res = await ask(alice.client, url, '@ai hi').expect(503);
    expect(res.body.error.code).toBe('AI_UNAVAILABLE');
  });

  it('explains when no AI provider is configured', async () => {
    setProvidersForTesting({});
    const { alice, url } = await team();
    await ask(alice.client, url, '@ai hi').expect(503);
  });

  it('allows one answer at a time, which can be stopped', async () => {
    fakeGemini(
      (req) =>
        new Promise((_resolve, reject) => {
          req.onText('Thinking about it…');
          req.signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const { alice, url } = await team();
    await ask(alice.client, url, '@ai long question').expect(201);
    await ask(alice.client, url, '@ai another').expect(409);

    let running = null;
    for (let i = 0; i < 50 && !running; i++) {
      running = await MessageModel.findOne({ kind: 'ai' });
      if (!running) await new Promise((r) => setTimeout(r, 20));
    }
    await alice.client.post(`${url}/${running!.id}/ai/stop`).expect(204);
    const doc = await finishedAnswer();
    expect(doc.ai.status).toBe('stopped');
    expect(doc.content).toBe('Thinking about it…');
  });
});

describe('suggested changes', () => {
  const proposing = {
    summary: 'Add a greeting module',
    changes: [
      { path: 'src/greet.js', action: 'create', content: 'export const hi = () => "hi";\n' },
      { path: 'script.js', action: 'update', content: 'console.log("updated");\n' },
      { path: '../outside.js', action: 'create', content: 'nope' },
      { path: 'missing.js', action: 'delete' },
    ],
  };

  async function withProposal() {
    fakeGemini(answer('I’ve proposed a greeting module.', proposing));
    const t = await team();
    await ask(t.alice.client, t.url, '@ai add a greeting module').expect(201);
    const doc = await finishedAnswer();
    return { ...t, messageId: doc.id as string, doc };
  }

  it('keeps only safe, meaningful changes and notes the rest', async () => {
    const { doc } = await withProposal();
    const proposal = doc.ai.proposal;
    expect(proposal.status).toBe('pending');
    expect(
      proposal.changes.map((c: { path: string; action: string }) => [c.path, c.action]),
    ).toEqual([
      ['src/greet.js', 'create'],
      ['script.js', 'update'],
    ]);
    expect(proposal.changes[1].before).toContain('counter');
    expect(doc.content).toMatch(/left out: \.\.\/outside\.js.*missing\.js/);
  });

  it('applies everything when accepted, once', async () => {
    const { alice, id, url, messageId } = await withProposal();
    const res = await alice.client.post(`${url}/${messageId}/proposal/apply`).expect(200);
    expect(res.body.ai.proposal.status).toBe('applied');

    const snap = await alice.client.get(`${P}/${id}/files/snapshot`).expect(200);
    const byPath = Object.fromEntries(
      snap.body.map((f: { path: string; content: string }) => [f.path, f.content]),
    );
    expect(byPath['src/greet.js']).toBe('export const hi = () => "hi";\n');
    expect(byPath['script.js']).toBe('console.log("updated");\n');

    await alice.client.post(`${url}/${messageId}/proposal/apply`).expect(409);
  });

  it('refuses to overwrite a file that changed after the suggestion', async () => {
    const { alice, id, url, messageId } = await withProposal();
    const file = await FileModel.findOne({ projectId: id, path: 'script.js' }).select('+yjsState');
    const { stateFromText } = await import('../src/modules/files/yjs.js');
    file!.yjsState = stateFromText(`${textFromState(file!.yjsState)}\n// teammate edit`);
    await file!.save();

    const res = await alice.client.post(`${url}/${messageId}/proposal/apply`).expect(409);
    expect(res.body.error.message).toMatch(/script\.js changed/);
  });

  it('lets editors dismiss suggestions, but not viewers', async () => {
    const { alice, vera, url, messageId } = await withProposal();
    await vera.client.post(`${url}/${messageId}/proposal/reject`).expect(403);
    const res = await alice.client.post(`${url}/${messageId}/proposal/reject`).expect(200);
    expect(res.body.ai.proposal.status).toBe('rejected');
  });
});
