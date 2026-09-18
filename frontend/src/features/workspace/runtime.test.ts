import { describe, expect, it } from 'vitest';
import { detectRuntime } from './runtime';

const f = (path: string, content = '') => ({ path, content });

describe('detectRuntime', () => {
  it('prefers a package.json dev script, then start', () => {
    expect(
      detectRuntime([f('package.json', '{"scripts":{"dev":"vite","start":"node x"}}')]),
    ).toMatchObject({
      kind: 'npm',
      script: 'dev',
    });
    expect(detectRuntime([f('package.json', '{"scripts":{"start":"node x"}}')])).toMatchObject({
      kind: 'npm',
      script: 'start',
    });
  });

  it('explains package.json problems instead of guessing', () => {
    expect(detectRuntime([f('package.json', '{nope'), f('index.html')]).kind).toBe('unsupported');
    expect(detectRuntime([f('package.json', '{"scripts":{"build":"x"}}')])).toMatchObject({
      kind: 'unsupported',
      reason: expect.stringContaining('"dev" or "start"'),
    });
  });

  it('serves a static site, or runs a single Node file', () => {
    expect(detectRuntime([f('index.html'), f('style.css')]).kind).toBe('static');
    expect(detectRuntime([f('server.js')])).toMatchObject({ kind: 'node', entry: 'server.js' });
  });

  it('names other languages as edit-only', () => {
    const r = detectRuntime([f('main.py'), f('utils.py'), f('README.md')]);
    expect(r).toMatchObject({ kind: 'unsupported', reason: expect.stringContaining('Python') });
  });
});
