/**
 * The collection hooks shape the right requests: CRUD on the collection
 * resource, membership patches on the document, and — the novel part — sharing,
 * which writes a record-scope grant on the collection plus a collection-scope
 * `in`-filter grant on documents. The engine enforces authorization; these just
 * build the payloads.
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { ACCESS_GRANTS } from '@rambleraptor/homestead-core/permissions/resources';
import { COLLECTIONS, DOCUMENTS } from '../resources';
import {
  collectionDocumentFilter,
  useCreateCollection,
  useSetDocumentCollections,
  useShareCollection,
  useUnshareCollection,
} from '../hooks/useCollections';

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(aepbase.list).mockResolvedValue([]);
  vi.mocked(aepbase.create).mockResolvedValue({ id: 'new' } as never);
  vi.mocked(aepbase.update).mockResolvedValue({ id: 'd1' } as never);
  vi.mocked(aepbase.remove).mockResolvedValue(undefined as never);
});

describe('collection hooks', () => {
  it('collectionDocumentFilter targets the collection id via `in`', () => {
    expect(collectionDocumentFilter('c1')).toBe("'c1' in collections");
  });

  it('useCreateCollection creates a collection with its fields', async () => {
    const { result } = renderHook(() => useCreateCollection(), { wrapper: createWrapper() });
    await result.current.mutateAsync({ name: 'Taxes', description: 'IRS', color: '#2563eb' });
    expect(aepbase.create).toHaveBeenCalledWith(
      COLLECTIONS,
      expect.objectContaining({ name: 'Taxes', description: 'IRS', color: '#2563eb' }),
    );
  });

  it('useSetDocumentCollections patches the document membership array', async () => {
    const { result } = renderHook(() => useSetDocumentCollections(), { wrapper: createWrapper() });
    await result.current.mutateAsync({ documentId: 'd1', collections: ['c1', 'c2'] });
    expect(aepbase.update).toHaveBeenCalledWith(DOCUMENTS, 'd1', { collections: ['c1', 'c2'] });
  });

  it('useShareCollection writes both the folder grant and the document filter grant', async () => {
    const { result } = renderHook(() => useShareCollection(), { wrapper: createWrapper() });
    await result.current.mutateAsync({
      collectionId: 'c1',
      subject: { type: 'user', id: 'bob' },
      capability: 'write',
    });

    // 1) record-scope grant on the collection → folder visibility
    expect(aepbase.create).toHaveBeenCalledWith(ACCESS_GRANTS, {
      subject_type: 'user',
      subject_id: 'bob',
      capability: 'write',
      target_scope: 'record',
      resource_type: 'collection',
      resource_id: 'c1',
    });
    // 2) collection-scope filter grant on documents → document access
    expect(aepbase.create).toHaveBeenCalledWith(ACCESS_GRANTS, {
      subject_type: 'user',
      subject_id: 'bob',
      capability: 'write',
      target_scope: 'collection',
      resource_type: 'document',
      filter: "'c1' in collections",
    });
  });

  it('useShareCollection defaults to write (view + add/remove + edit)', async () => {
    const { result } = renderHook(() => useShareCollection(), { wrapper: createWrapper() });
    await result.current.mutateAsync({ collectionId: 'c1', subject: { type: 'user', id: 'bob' } });
    const calls = vi.mocked(aepbase.create).mock.calls;
    expect(calls.every(([, body]) => (body as { capability: string }).capability === 'write')).toBe(true);
  });

  it('useUnshareCollection removes both paired grants', async () => {
    const { result } = renderHook(() => useUnshareCollection(), { wrapper: createWrapper() });
    await result.current.mutateAsync({
      collectionId: 'c1',
      share: {
        recordGrantId: 'g-record',
        documentGrantId: 'g-doc',
        subject_type: 'user',
        subject_id: 'bob',
        capability: 'write',
      },
    });
    expect(aepbase.remove).toHaveBeenCalledWith(ACCESS_GRANTS, 'g-record');
    expect(aepbase.remove).toHaveBeenCalledWith(ACCESS_GRANTS, 'g-doc');
  });
});
