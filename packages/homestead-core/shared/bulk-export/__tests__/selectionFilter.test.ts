import { describe, expect, it } from 'vitest';
import { selectionFilter } from '../useBulkExport';

describe('selectionFilter', () => {
  it('builds an `id in [...]` CEL filter from selected ids', () => {
    expect(selectionFilter(['a', 'b', 'c'])).toBe('id in ["a", "b", "c"]');
  });

  it('quotes a single id', () => {
    expect(selectionFilter(['only'])).toBe('id in ["only"]');
  });

  it('returns undefined for an empty selection (nothing to export)', () => {
    expect(selectionFilter([])).toBeUndefined();
  });
});
