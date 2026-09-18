import { describe, expect, it } from 'vitest';
import { safeRedirect } from './auth';

describe('safeRedirect', () => {
  it('keeps same-site paths', () => {
    expect(safeRedirect('/invite/abc?x=1')).toBe('/invite/abc?x=1');
  });

  it('refuses other sites and odd values', () => {
    for (const bad of ['https://evil.test', '//evil.test/x', 'javascript:alert(1)', '', 42, null]) {
      expect(safeRedirect(bad)).toBe('/dashboard');
    }
  });
});
