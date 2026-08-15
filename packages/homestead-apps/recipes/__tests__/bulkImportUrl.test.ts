import { describe, expect, it } from 'vitest';
import parser, { splitUrls } from '../methods/bulk-import-url';

describe('splitUrls', () => {
  it('reads one URL per line', () => {
    expect(splitUrls('https://a.example/1\nhttps://b.example/2')).toEqual([
      'https://a.example/1',
      'https://b.example/2',
    ]);
  });

  it('ignores blank lines, whitespace and # comments', () => {
    const text = [
      '  https://a.example/1  ',
      '',
      '   ',
      '# a note about the next one',
      'https://b.example/2',
    ].join('\n');
    expect(splitUrls(text)).toEqual(['https://a.example/1', 'https://b.example/2']);
  });

  it('handles CRLF line endings', () => {
    expect(splitUrls('https://a.example/1\r\nhttps://b.example/2')).toHaveLength(2);
  });

  it('returns nothing for empty input', () => {
    expect(splitUrls('   \n\n  ')).toEqual([]);
  });
});

const ctx = { auth: { token: 't', user: { path: 'users/1' } }, plural: 'recipes' } as never;

describe('bulk-import-url parser', () => {
  it('reports empty input as an errored item rather than throwing', async () => {
    const items = await parser.parse({ text: '' }, ctx);
    expect(items).toHaveLength(1);
    expect(items[0].errors[0]).toMatch(/paste at least one/i);
  });

  it('refuses a paste longer than the per-import cap', async () => {
    const text = Array.from({ length: 21 }, (_, i) => `https://a.example/${i}`).join('\n');
    const items = await parser.parse({ text }, ctx);
    expect(items).toHaveLength(1);
    expect(items[0].errors[0]).toMatch(/at most 20/i);
  });

  // No network: the fence rejects a private address before any connection.
  it('turns a blocked URL into one errored row, not a thrown import', async () => {
    const items = await parser.parse({ text: 'http://192.168.1.1/recipe' }, ctx);
    expect(items).toHaveLength(1);
    expect(items[0].errors).toHaveLength(1);
    expect(items[0].errors[0]).toMatch(/non-public address/i);
  });

  it('keeps one bad URL from sinking its siblings', async () => {
    const items = await parser.parse(
      { text: 'http://127.0.0.1/a\nhttp://10.0.0.5/b' },
      ctx,
    );
    expect(items).toHaveLength(2);
    // Both are blocked here, but each is reported on its own row and labelled
    // with the URL it came from.
    expect(items.map((i) => i.label)).toEqual([
      'http://127.0.0.1/a',
      'http://10.0.0.5/b',
    ]);
    expect(items.every((i) => i.errors.length === 1)).toBe(true);
  });

  it('documents its input for the import page', () => {
    expect(parser.columns?.[0]).toMatchObject({ name: 'URL', required: true });
  });
});
