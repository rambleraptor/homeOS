import { describe, expect, test } from 'vitest';
import { compileFilter } from '../../src/engine/filter';
import type { Schema } from '../../src/engine/types';

const schema: Schema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    pages: { type: 'integer' },
    in_print: { type: 'boolean' },
    id: { type: 'string', readOnly: true },
  },
};

describe('compileFilter', () => {
  test('equality on a string field', () => {
    const f = compileFilter('title == "Dune"', schema);
    expect(f.sql).toBe('title = ?');
    expect(f.params).toEqual(['Dune']);
  });

  test('single-quoted strings', () => {
    const f = compileFilter("title == 'Dune'", schema);
    expect(f.params).toEqual(['Dune']);
  });

  test('numeric comparisons', () => {
    for (const [op, sql] of [
      ['!=', '!='],
      ['<', '<'],
      ['<=', '<='],
      ['>', '>'],
      ['>=', '>='],
    ] as const) {
      const f = compileFilter(`pages ${op} 100`, schema);
      expect(f.sql).toBe(`pages ${sql} ?`);
      expect(f.params).toEqual([100]);
    }
  });

  test('negative and decimal numbers', () => {
    expect(compileFilter('pages > -1', schema).params).toEqual([-1]);
    expect(compileFilter('pages > 1.5', schema).params).toEqual([1.5]);
  });

  test('booleans bind as 0/1', () => {
    const f = compileFilter('in_print == true', schema);
    expect(f.params).toEqual([1]);
    expect(compileFilter('in_print == false', schema).params).toEqual([0]);
  });

  test('&& and || with precedence and parens', () => {
    const f = compileFilter('title == "a" && pages > 1 || in_print == true', schema);
    expect(f.sql).toBe('(title = ? AND pages > ? OR in_print = ?)');
    expect(f.params).toEqual(['a', 1, 1]);

    const g = compileFilter('title == "a" && (pages > 1 || in_print == true)', schema);
    expect(g.sql).toBe('title = ? AND ((pages > ? OR in_print = ?))');
  });

  test('literal can appear on the left', () => {
    const f = compileFilter('100 < pages', schema);
    expect(f.sql).toBe('? < pages');
  });

  test('rejects unknown fields (no injection through identifiers)', () => {
    expect(() => compileFilter('password == "x"', schema)).toThrow(/invalid filter/);
    // standard fields are not filterable, matching the Go CEL env
    expect(() => compileFilter('id == "x"', schema)).toThrow(/invalid filter/);
  });

  test('rejects malformed expressions', () => {
    for (const bad of [
      'title ==',
      '== "x"',
      'title = "x"', // single = is not an operator
      'title == "x" &&',
      '(title == "x"',
      'title == "x" extra',
      '1 == 2', // no field reference
      'title; DROP TABLE books',
    ]) {
      expect(() => compileFilter(bad, schema)).toThrow(/invalid filter/);
    }
  });

  test('values only travel as parameters', () => {
    const f = compileFilter(`title == "'; DROP TABLE books; --"`, schema);
    expect(f.sql).toBe('title = ?');
    expect(f.params[0]).toBe("'; DROP TABLE books; --");
  });
});
