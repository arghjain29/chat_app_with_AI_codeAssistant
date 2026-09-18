import { describe, expect, it } from 'vitest';
import { canCreateProject, PLANS } from './plans.js';
import { hasRole } from './roles.js';

describe('canCreateProject', () => {
  it('enforces the free project cap', () => {
    const max = PLANS.free.limits.maxOwnedProjects!;
    expect(canCreateProject('free', max - 1)).toBe(true);
    expect(canCreateProject('free', max)).toBe(false);
  });

  it('is unlimited on pro', () => {
    expect(canCreateProject('pro', 10_000)).toBe(true);
  });
});

describe('hasRole', () => {
  it('ranks owner > editor > viewer', () => {
    expect(hasRole('owner', 'editor')).toBe(true);
    expect(hasRole('editor', 'editor')).toBe(true);
    expect(hasRole('viewer', 'editor')).toBe(false);
  });
});
