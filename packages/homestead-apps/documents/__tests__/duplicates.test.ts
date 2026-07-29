import { describe, it, expect } from 'vitest';
import { findDuplicateUploads } from '../duplicates';
import type { Document } from '../types';

function doc(over: Partial<Document> & { id: string }): Document {
  return { path: `documents/${over.id}`, ...over };
}

describe('findDuplicateUploads', () => {
  it('flags an upload that matches an earlier document', () => {
    const original = doc({ id: 'a', content_hash: 'h1', create_time: '2026-01-01T00:00:00Z' });
    const upload = doc({ id: 'b', content_hash: 'h1', create_time: '2026-02-01T00:00:00Z' });

    const result = findDuplicateUploads([upload, original], ['b']);

    expect(result).toEqual([{ upload, original }]);
  });

  it('does not flag a unique upload', () => {
    const a = doc({ id: 'a', content_hash: 'h1', create_time: '2026-01-01T00:00:00Z' });
    const b = doc({ id: 'b', content_hash: 'h2', create_time: '2026-02-01T00:00:00Z' });

    expect(findDuplicateUploads([a, b], ['b'])).toEqual([]);
  });

  it('skips an upload whose hash has not been stamped yet', () => {
    const a = doc({ id: 'a', content_hash: 'h1', create_time: '2026-01-01T00:00:00Z' });
    const pending = doc({ id: 'b', create_time: '2026-02-01T00:00:00Z' }); // no content_hash

    expect(findDuplicateUploads([a, pending], ['b'])).toEqual([]);
  });

  it('does not flag the original, even when it is in the uploaded set', () => {
    // Two identical files in one batch: only the later copy is a duplicate.
    const first = doc({ id: 'a', content_hash: 'h1', create_time: '2026-01-01T00:00:00Z' });
    const second = doc({ id: 'b', content_hash: 'h1', create_time: '2026-01-01T00:05:00Z' });

    const result = findDuplicateUploads([second, first], ['a', 'b']);

    expect(result).toEqual([{ upload: second, original: first }]);
  });

  it('ignores an uploaded id no longer in the list (e.g. just deleted)', () => {
    const a = doc({ id: 'a', content_hash: 'h1', create_time: '2026-01-01T00:00:00Z' });

    expect(findDuplicateUploads([a], ['deleted-id'])).toEqual([]);
  });
});
