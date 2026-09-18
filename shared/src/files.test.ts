import { describe, expect, it } from 'vitest';
import { FilePathSchema, parseDocName } from './files.js';

describe('FilePathSchema', () => {
  it('accepts normal project paths and tidies slashes', () => {
    expect(FilePathSchema.parse('src/app.ts')).toBe('src/app.ts');
    expect(FilePathSchema.parse('src//components/')).toBe('src/components');
    expect(FilePathSchema.parse('@types/my file.d.ts')).toBe('@types/my file.d.ts');
  });

  it('rejects paths that could escape the project', () => {
    for (const bad of ['../etc/passwd', 'src/../../x', '/abs/path', 'a\\b', './x', 'a/./b', '']) {
      expect(FilePathSchema.safeParse(bad).success, bad).toBe(false);
    }
  });
});

describe('parseDocName', () => {
  it('parses file and project document names', () => {
    expect(parseDocName('file:0123456789abcdef01234567')).toEqual({
      kind: 'file',
      id: '0123456789abcdef01234567',
    });
    expect(parseDocName('project:0123456789abcdef01234567')?.kind).toBe('project');
    expect(parseDocName('file:nope')).toBeNull();
    expect(parseDocName('other:0123456789abcdef01234567')).toBeNull();
  });
});
