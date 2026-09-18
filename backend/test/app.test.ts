import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { UserModel } from '../src/modules/users/user.model.js';

const app = createApp();

describe('health', () => {
  it('reports ok and ready', async () => {
    await request(app).get('/health').expect(200, { status: 'ok' });
    const ready = await request(app).get('/ready').expect(200);
    expect(ready.body.checks.mongo).toBe(true);
  });

  it('returns a request id header', async () => {
    const res = await request(app).get('/health').set('x-request-id', 'abc-123');
    expect(res.headers['x-request-id']).toBe('abc-123');
  });
});

describe('GET /api/v1/users/me', () => {
  it('rejects anonymous requests with a structured error', async () => {
    const res = await request(app).get('/api/v1/users/me').expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    expect(res.body.error.requestId).toBeTruthy();
  });

  it('creates the local user on first sign-in and returns it', async () => {
    const res = await request(app)
      .get('/api/v1/users/me')
      .set('x-test-user', 'user_alice')
      .expect(200);
    expect(res.body).toMatchObject({ email: 'user_alice@example.com', plan: 'free' });
    expect(await UserModel.countDocuments()).toBe(1);

    await request(app).get('/api/v1/users/me').set('x-test-user', 'user_alice').expect(200);
    expect(await UserModel.countDocuments()).toBe(1);
  });

  it('gives colliding usernames a unique suffix', async () => {
    await UserModel.create({ clerkId: 'other', email: 'x@example.com', username: 'user_bob' });
    const res = await request(app)
      .get('/api/v1/users/me')
      .set('x-test-user', 'user_bob')
      .expect(200);
    expect(res.body.username).not.toBe('user_bob');
    expect(res.body.username).toMatch(/^user_bob-/);
  });
});

describe('unknown routes', () => {
  it('return a 404 error body', async () => {
    const res = await request(app).get('/nope').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('Clerk webhook', () => {
  it('rejects unsigned payloads', async () => {
    await request(app)
      .post('/webhooks/clerk')
      .set('content-type', 'application/json')
      .send(JSON.stringify({ type: 'user.created', data: {} }))
      .expect(400);
  });
});
