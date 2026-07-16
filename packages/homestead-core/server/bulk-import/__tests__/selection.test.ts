import { describe, expect, it } from 'vitest';
import { resolveSelection } from '../handler';
import type { ParsedItem } from '../../../resources/bulk-import/types';

const item = (index: number, errors: string[] = []): ParsedItem => ({
  index,
  data: { n: index },
  errors,
  warnings: [],
});

// 0 and 2 are importable; 1 is not.
const items = [item(0), item(1, ['merchant is required']), item(2)];

describe('resolveSelection', () => {
  it('defaults to every importable item when the selection is omitted', () => {
    // This default is what makes a one-shot CLI/REST import possible.
    expect(resolveSelection(items, undefined).map((i) => i.index)).toEqual([0, 2]);
  });

  it('treats "*" the same as omitted', () => {
    expect(resolveSelection(items, '*').map((i) => i.index)).toEqual([0, 2]);
  });

  it('honours an explicit index list', () => {
    expect(resolveSelection(items, [2]).map((i) => i.index)).toEqual([2]);
  });

  it('ignores duplicate indices', () => {
    expect(resolveSelection(items, [0, 0, 2]).map((i) => i.index)).toEqual([0, 2]);
  });

  it('rejects an explicitly selected item that has errors', () => {
    // Silently skipping it would report "imported 1 of 2" with no reason why.
    expect(() => resolveSelection(items, [0, 1])).toThrow(/index 1 has errors/);
  });

  it('rejects an index that is not in the parsed input', () => {
    expect(() => resolveSelection(items, [7])).toThrow(/index 7 is not in the parsed input/);
  });

  it('selects nothing from an empty list', () => {
    expect(resolveSelection(items, [])).toEqual([]);
  });
});
