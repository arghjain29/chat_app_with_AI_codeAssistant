import type { PlanId } from '@codecollab/shared';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { UserModel } from '../src/modules/users/user.model.js';

export const app = createApp();

/** A signed-in HTTP client for the given Clerk id (see the Clerk fake in setup.ts). */
export const as = (clerkId: string) => {
  const withUser = (r: request.Test) => r.set('x-test-user', clerkId);
  return {
    get: (url: string) => withUser(request(app).get(url)),
    post: (url: string, body?: object) => withUser(request(app).post(url)).send(body),
    patch: (url: string, body?: object) => withUser(request(app).patch(url)).send(body),
    delete: (url: string) => withUser(request(app).delete(url)),
  };
};

/** Create (or fetch) a user by signing them in, optionally setting their plan. */
export async function signUp(clerkId: string, plan: PlanId = 'free') {
  const res = await as(clerkId).get('/api/v1/users/me').expect(200);
  // Pro is a prepaid pass, so it needs an expiry in the future to count.
  if (plan !== 'free') {
    await UserModel.updateOne({ clerkId }, { plan, proUntil: new Date(Date.now() + 30 * 864e5) });
  }
  return { id: res.body.id as string, client: as(clerkId) };
}

export async function createProject(client: ReturnType<typeof as>, name = 'Demo project') {
  const res = await client.post('/api/v1/projects', { name }).expect(201);
  return res.body as { id: string; slug: string };
}

/** Owner creates an invite and `joiner` accepts it. */
export async function invite(
  owner: ReturnType<typeof as>,
  projectId: string,
  opts: { role?: 'editor' | 'viewer'; maxUses?: number | null } = {},
) {
  const res = await owner.post(`/api/v1/projects/${projectId}/invites`, opts).expect(201);
  return res.body as { id: string; token: string };
}
