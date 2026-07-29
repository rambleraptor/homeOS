import { describe, expect, test } from 'vitest';
import { compileOrderBy } from '../../src/engine/order';
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

describe('compileOrderBy', () => {
  test('ascending by default', () => {
    expect(compileOrderBy('title', schema)).toBe('title ASC');
  });

  test('- prefix means descending', () => {
    expect(compileOrderBy('-pages', schema)).toBe('pages DESC');
  });

  test('comma-separated multi-field, mixed directions', () => {
    expect(compileOrderBy('title,-pages', schema)).toBe('title ASC, pages DESC');
    expect(compileOrderBy('-title,pages', schema)).toBe('title DESC, pages ASC');
  });

  test('redundant whitespace is insignificant', () => {
    const want = 'title ASC, pages DESC';
    expect(compileOrderBy('title, -pages', schema)).toBe(want);
    expect(compileOrderBy(' title , -pages ', schema)).toBe(want);
    expect(compileOrderBy('title,-pages', schema)).toBe(want);
    expect(compileOrderBy('- pages', schema)).toBe('pages DESC');
  });

  test('standard fields are orderable', () => {
    expect(compileOrderBy('-create_time', schema)).toBe('create_time DESC');
    expect(compileOrderBy('update_time,id', schema)).toBe('update_time ASC, id ASC');
  });

  test('empty / whitespace-only value compiles to empty', () => {
    expect(compileOrderBy('', schema)).toBe('');
    expect(compileOrderBy('   ', schema)).toBe('');
  });

  test('subfields resolve to their derived union column', () => {
    const unionSchema: Schema = {
      type: 'object',
      properties: {
        metadata: {
          type: 'object',
          oneOf: [
            {
              type: 'object',
              required: ['doc_type'],
              properties: {
                doc_type: { type: 'string', enum: ['form-1099-int'] },
                box_1_interest: { type: 'number' },
              },
            },
          ],
          discriminator: { propertyName: 'doc_type' },
        },
      },
    } as unknown as Schema;
    // `metadata.box_1_interest` resolves to the flat derived column
    // `box_1_interest` (json-extracted at DDL time), same as compileFilter.
    expect(compileOrderBy('metadata.box_1_interest', unionSchema)).toBe('box_1_interest ASC');
    expect(compileOrderBy('-metadata.box_1_interest', unionSchema)).toBe('box_1_interest DESC');
  });

  test('rejects unknown fields (no injection through identifiers)', () => {
    expect(() => compileOrderBy('password', schema)).toThrow(/invalid order_by/);
    expect(() => compileOrderBy('title; DROP TABLE books', schema)).toThrow(/invalid order_by/);
    expect(() => compileOrderBy('title,', schema)).toThrow(/invalid order_by/);
    expect(() => compileOrderBy('-', schema)).toThrow(/invalid order_by/);
  });
});
