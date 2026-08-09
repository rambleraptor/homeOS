import { describe, expect, it } from 'vitest';
import { BulkExportSelectionError, selectByIds } from '../select';

const records = [
  { id: 'a', name: 'Ada' },
  { id: 'b', name: 'Grace' },
  { id: 'c', name: 'Linus' },
];
const byId = (r: { id: string }) => r.id;

describe('selectByIds', () => {
  it('returns everything when no ids are given (export-all default)', () => {
    expect(selectByIds(records, undefined, byId)).toEqual(records);
  });

  it('narrows to the allowlist', () => {
    expect(selectByIds(records, ['a', 'c'], byId).map((r) => r.name)).toEqual(['Ada', 'Linus']);
  });

  it('preserves the collection order, not the id order', () => {
    expect(selectByIds(records, ['c', 'a'], byId).map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('rejects the whole selection when an id is missing', () => {
    expect(() => selectByIds(records, ['a', 'zzz'], byId)).toThrow(BulkExportSelectionError);
    try {
      selectByIds(records, ['a', 'zzz'], byId);
    } catch (error) {
      expect((error as BulkExportSelectionError).missing).toEqual(['zzz']);
    }
  });

  it('ignores duplicate ids', () => {
    expect(selectByIds(records, ['a', 'a'], byId).map((r) => r.id)).toEqual(['a']);
  });
});
