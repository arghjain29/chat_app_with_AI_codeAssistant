import { PLANS } from '@codecollab/shared';
import { describe, expect, it } from 'vitest';
import { InviteModel } from '../src/modules/projects/invite.model.js';
import { MembershipModel } from '../src/modules/projects/membership.model.js';
import { ProjectModel } from '../src/modules/projects/project.model.js';
import { deleteUserByClerkId } from '../src/modules/users/user.service.js';
import { createProject, invite, signUp } from './helpers.js';

const P = '/api/v1/projects';

describe('creating projects', () => {
  it('makes the creator the owner', async () => {
    const alice = await signUp('alice');
    const res = await alice.client.post(P, { name: 'My App', description: 'Hi' }).expect(201);
    expect(res.body).toMatchObject({
      name: 'My App',
      slug: 'my-app',
      description: 'Hi',
      role: 'owner',
      memberCount: 1,
      owner: { id: alice.id, username: 'alice' },
    });
  });

  it('rejects an empty name', async () => {
    const alice = await signUp('alice');
    const res = await alice.client.post(P, { name: '   ' }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('allows the same name for different owners, and de-duplicates slugs per owner', async () => {
    const alice = await signUp('alice');
    const bob = await signUp('bob');
    await createProject(alice.client, 'Shop');
    expect((await createProject(bob.client, 'Shop')).slug).toBe('shop');
    expect((await createProject(alice.client, 'Shop')).slug).toMatch(/^shop-[0-9a-f]{4}$/);
  });

  it('enforces the free plan project limit', async () => {
    const alice = await signUp('alice');
    const max = PLANS.free.limits.maxOwnedProjects!;
    for (let i = 0; i < max; i++) await createProject(alice.client, `p${i}`);

    const res = await alice.client.post(P, { name: 'one too many' }).expect(402);
    expect(res.body.error).toMatchObject({
      code: 'PLAN_LIMIT',
      details: { limit: 'maxOwnedProjects', plan: 'free' },
    });
  });

  it('has no project limit on pro', async () => {
    const alice = await signUp('alice', 'pro');
    for (let i = 0; i < PLANS.free.limits.maxOwnedProjects! + 2; i++) {
      await createProject(alice.client, `p${i}`);
    }
  });
});

describe('project access', () => {
  it('lists only projects the user belongs to', async () => {
    const alice = await signUp('alice');
    const bob = await signUp('bob');
    await createProject(alice.client, 'Alice only');
    await createProject(bob.client, 'Bob only');

    const res = await alice.client.get(P).expect(200);
    expect(res.body.map((p: { name: string }) => p.name)).toEqual(['Alice only']);
  });

  it('hides projects from non-members with a 404 (v1 leaked them)', async () => {
    const alice = await signUp('alice');
    const mallory = await signUp('mallory');
    const { id } = await createProject(alice.client);

    await mallory.client.get(`${P}/${id}`).expect(404);
    await mallory.client.get(`${P}/${id}/members`).expect(404);
    await mallory.client.patch(`${P}/${id}`, { name: 'pwned' }).expect(404);
    await mallory.client.delete(`${P}/${id}`).expect(404);
  });

  it('treats malformed ids as not found', async () => {
    const alice = await signUp('alice');
    await alice.client.get(`${P}/not-an-id`).expect(404);
  });

  it('lets only the owner rename or delete', async () => {
    const alice = await signUp('alice');
    const bob = await signUp('bob');
    const { id } = await createProject(alice.client);
    const { token } = await invite(alice.client, id, { role: 'editor' });
    await bob.client.post(`/api/v1/invites/${token}/accept`).expect(200);

    const denied = await bob.client.patch(`${P}/${id}`, { name: 'Renamed' }).expect(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');
    await bob.client.delete(`${P}/${id}`).expect(403);

    const res = await alice.client.patch(`${P}/${id}`, { name: 'Renamed' }).expect(200);
    expect(res.body).toMatchObject({ name: 'Renamed', slug: 'renamed' });
  });

  it('deletes memberships and invites along with the project', async () => {
    const alice = await signUp('alice');
    const bob = await signUp('bob');
    const { id } = await createProject(alice.client);
    const { token } = await invite(alice.client, id);
    await bob.client.post(`/api/v1/invites/${token}/accept`).expect(200);
    await invite(alice.client, id);

    await alice.client.delete(`${P}/${id}`).expect(204);
    expect(await ProjectModel.countDocuments()).toBe(0);
    expect(await MembershipModel.countDocuments()).toBe(0);
    expect(await InviteModel.countDocuments()).toBe(0);
  });
});

describe('invites', () => {
  it('lets someone join with the invited role', async () => {
    const alice = await signUp('alice');
    const bob = await signUp('bob');
    const { id } = await createProject(alice.client, 'Team app');
    const { token } = await invite(alice.client, id, { role: 'viewer' });

    const preview = await bob.client.get(`/api/v1/invites/${token}`).expect(200);
    expect(preview.body).toMatchObject({
      projectId: id,
      projectName: 'Team app',
      role: 'viewer',
      alreadyMember: false,
      owner: { username: 'alice' },
    });

    await bob.client.post(`/api/v1/invites/${token}/accept`).expect(200, { projectId: id });
    const project = await bob.client.get(`${P}/${id}`).expect(200);
    expect(project.body).toMatchObject({ role: 'viewer', memberCount: 2 });

    // Accepting again is harmless.
    await bob.client.post(`/api/v1/invites/${token}/accept`).expect(200);
    expect(await MembershipModel.countDocuments({ projectId: id })).toBe(2);
  });

  it('never returns the token after creation, and stores only its hash', async () => {
    const alice = await signUp('alice');
    const { id } = await createProject(alice.client);
    const { token } = await invite(alice.client, id);

    const list = await alice.client.get(`${P}/${id}/invites`).expect(200);
    expect(list.body).toHaveLength(1);
    expect(JSON.stringify(list.body)).not.toContain(token);
    expect(await InviteModel.exists({ tokenHash: token })).toBeNull();
  });

  it('only lets the owner manage invites', async () => {
    const alice = await signUp('alice');
    const bob = await signUp('bob');
    const { id } = await createProject(alice.client);
    const { token } = await invite(alice.client, id, { role: 'editor' });
    await bob.client.post(`/api/v1/invites/${token}/accept`).expect(200);

    await bob.client.post(`${P}/${id}/invites`, {}).expect(403);
    await bob.client.get(`${P}/${id}/invites`).expect(403);
  });

  it('stops working once used up, revoked or expired', async () => {
    const alice = await signUp('alice', 'pro');
    const [bob, carol, dan, erin] = await Promise.all(
      ['bob', 'carol', 'dan', 'erin'].map((n) => signUp(n)),
    );
    const { id } = await createProject(alice.client);

    const single = await invite(alice.client, id, { maxUses: 1 });
    await bob!.client.post(`/api/v1/invites/${single.token}/accept`).expect(200);
    const used = await carol!.client.post(`/api/v1/invites/${single.token}/accept`).expect(410);
    expect(used.body.error.code).toBe('GONE');

    const revoked = await invite(alice.client, id);
    await alice.client.delete(`${P}/${id}/invites/${revoked.id}`).expect(204);
    await dan!.client.get(`/api/v1/invites/${revoked.token}`).expect(410);

    const expired = await invite(alice.client, id);
    await InviteModel.updateOne({ _id: expired.id }, { expiresAt: new Date(Date.now() - 1000) });
    await erin!.client.post(`/api/v1/invites/${expired.token}/accept`).expect(410);
  });

  it('returns 404 for unknown or malformed tokens', async () => {
    const bob = await signUp('bob');
    await bob.client.get('/api/v1/invites/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa').expect(404);
    await bob.client.get('/api/v1/invites/bad!').expect(404);
  });

  it('enforces the owner’s plan member limit', async () => {
    const alice = await signUp('alice');
    const { id } = await createProject(alice.client);
    const { token } = await invite(alice.client, id);
    const max = PLANS.free.limits.maxMembersPerProject;

    for (let i = 1; i < max; i++) {
      const u = await signUp(`member${i}`);
      await u.client.post(`/api/v1/invites/${token}/accept`).expect(200);
    }
    const late = await signUp('late');
    const res = await late.client.post(`/api/v1/invites/${token}/accept`).expect(402);
    expect(res.body.error.details).toMatchObject({ limit: 'maxMembersPerProject' });
  });
});

describe('members', () => {
  async function teamOfThree() {
    const alice = await signUp('alice');
    const bob = await signUp('bob');
    const carol = await signUp('carol');
    const { id } = await createProject(alice.client);
    const { token } = await invite(alice.client, id, { role: 'editor' });
    await bob.client.post(`/api/v1/invites/${token}/accept`).expect(200);
    await carol.client.post(`/api/v1/invites/${token}/accept`).expect(200);
    return { alice, bob, carol, id };
  }

  it('lists the owner first', async () => {
    const { bob, id } = await teamOfThree();
    const res = await bob.client.get(`${P}/${id}/members`).expect(200);
    expect(res.body.map((m: { username: string; role: string }) => [m.username, m.role])).toEqual([
      ['alice', 'owner'],
      ['bob', 'editor'],
      ['carol', 'editor'],
    ]);
  });

  it('lets the owner change roles, but not their own', async () => {
    const { alice, bob, id } = await teamOfThree();
    const res = await alice.client.patch(`${P}/${id}/members/${bob.id}`, { role: 'viewer' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('viewer');

    await alice.client.patch(`${P}/${id}/members/${alice.id}`, { role: 'editor' }).expect(400);
    await alice.client.patch(`${P}/${id}/members/${bob.id}`, { role: 'owner' }).expect(400);
  });

  it('stops non-owners from changing roles or removing others', async () => {
    const { bob, carol, id } = await teamOfThree();
    await bob.client.patch(`${P}/${id}/members/${carol.id}`, { role: 'viewer' }).expect(403);
    await bob.client.delete(`${P}/${id}/members/${carol.id}`).expect(403);
  });

  it('lets members leave, but not the owner', async () => {
    const { alice, bob, id } = await teamOfThree();
    await bob.client.delete(`${P}/${id}/members/${bob.id}`).expect(204);
    await bob.client.get(`${P}/${id}`).expect(404);

    const res = await alice.client.delete(`${P}/${id}/members/${alice.id}`).expect(400);
    expect(res.body.error.message).toMatch(/Delete the project/);
  });

  it('lets the owner remove a member', async () => {
    const { alice, carol, id } = await teamOfThree();
    await alice.client.delete(`${P}/${id}/members/${carol.id}`).expect(204);
    await carol.client.get(`${P}/${id}`).expect(404);
  });
});

describe('deleting an account', () => {
  it('removes owned projects and other memberships', async () => {
    const alice = await signUp('alice');
    const bob = await signUp('bob');
    const alices = await createProject(alice.client, 'Alice’s');
    const bobs = await createProject(bob.client, 'Bob’s');
    const { token } = await invite(bob.client, bobs.id);
    await alice.client.post(`/api/v1/invites/${token}/accept`).expect(200);

    await deleteUserByClerkId('alice');

    expect(await ProjectModel.exists({ _id: alices.id })).toBeNull();
    expect(await MembershipModel.countDocuments({ userId: alice.id })).toBe(0);
    const res = await bob.client.get(`${P}/${bobs.id}`).expect(200);
    expect(res.body.memberCount).toBe(1);
  });
});

describe('member previews', () => {
  it('lists the owner first, then others, up to four', async () => {
    const alice = await signUp('alice', 'pro');
    const { id } = await createProject(alice.client);
    const { token } = await invite(alice.client, id);
    for (const name of ['bob', 'carol', 'dan', 'erin']) {
      const u = await signUp(name);
      await u.client.post(`/api/v1/invites/${token}/accept`).expect(200);
    }
    const res = await alice.client.get(`${P}/${id}`).expect(200);
    expect(res.body.memberCount).toBe(5);
    expect(res.body.members.map((m: { username: string }) => m.username)).toEqual([
      'alice',
      'bob',
      'carol',
      'dan',
    ]);
  });
});
