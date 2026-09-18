import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./env', () => ({ env: { VITE_API_URL: 'http://api.test' } }));

const { api, ApiError, setTokenGetter } = await import('./api');

afterEach(() => vi.unstubAllGlobals());

describe('api', () => {
  it('sends the session token and returns JSON', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    setTokenGetter(async () => 'tok');

    await expect(api('/users/me')).resolves.toEqual({ ok: 1 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://api.test/api/v1/users/me');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok');
  });

  it('maps error bodies to ApiError', async () => {
    const body = { error: { code: 'PLAN_LIMIT', message: 'Upgrade to create more projects' } };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 402 })),
    );

    const err = await api('/projects').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 402,
      code: 'PLAN_LIMIT',
      message: 'Upgrade to create more projects',
    });
  });

  it('reports network failures in plain words', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api('/x')).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining('reach the server'),
    });
  });
});
