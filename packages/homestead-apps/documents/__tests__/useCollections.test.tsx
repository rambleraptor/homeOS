/**
 * The collection hooks shape the right requests: CRUD on the collection
 * resource, membership patches on the document, and the document *cascade seam*
 * — the collection-scope `in`-filter grant on documents that pairs with a folder
 * share (the record grant itself is owned by the generic ShareRecordDialog). The
 * engine enforces authorization; these just build the payloads.
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { ACCESS_GRANTS } from '@rambleraptor/homestead-core/permissions/resources';
import type { AccessGrantRecord } from '@rambleraptor/homestead-core/permissions/hooks';
import { COLLECTIONS, DOCUMENTS } from '../resources';
import {
  collectionDocumentFilter,
  useCreateCollection,
  useSetDocumentCollections,
  useShareCollectionDocuments,
  useUnshareCollectionDocuments,
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

  it('useShareCollectionDocuments writes the collection-scope document filter grant', async () => {
    const { result } = renderHook(() => useShareCollectionDocuments(), { wrapper: createWrapper() });
    await result.current.mutateAsync({
      collectionId: 'c1',
      subject: { type: 'user', id: 'bob' },
      capability: 'write',
      effect: 'allow',
    });

    expect(aepbase.create).toHaveBeenCalledWith(ACCESS_GRANTS, {
      subject_type: 'user',
      subject_id: 'bob',
      capability: 'write',
      target_scope: 'collection',
      resource_type: 'document',
      filter: "'c1' in collections",
    });
    // An allow omits `effect`, staying byte-identical to the pre-deny payload.
    const [, body] = vi.mocked(aepbase.create).mock.calls[0];
    expect('effect' in (body as object)).toBe(false);
  });

  it('useShareCollectionDocuments shares to a group', async () => {
    const { result } = renderHook(() => useShareCollectionDocuments(), { wrapper: createWrapper() });
    await result.current.mutateAsync({
      collectionId: 'c1',
      subject: { type: 'group', id: 'g1' },
      capability: 'read',
      effect: 'allow',
    });
    expect(aepbase.create).toHaveBeenCalledWith(
      ACCESS_GRANTS,
      expect.objectContaining({ subject_type: 'group', subject_id: 'g1', capability: 'read' }),
    );
  });

  it('useShareCollectionDocuments stamps a deny grant when blocking', async () => {
    const { result } = renderHook(() => useShareCollectionDocuments(), { wrapper: createWrapper() });
    await result.current.mutateAsync({
      collectionId: 'c1',
      subject: { type: 'user', id: 'bob' },
      capability: 'manage',
      effect: 'deny',
    });
    expect(aepbase.create).toHaveBeenCalledWith(ACCESS_GRANTS, {
      subject_type: 'user',
      subject_id: 'bob',
      capability: 'manage',
      effect: 'deny',
      target_scope: 'collection',
      resource_type: 'document',
      filter: "'c1' in collections",
    });
  });

  it('useUnshareCollectionDocuments removes the doc grant paired to a revoked record grant', async () => {
    const docFilter = collectionDocumentFilter('c1');
    vi.mocked(aepbase.list).mockResolvedValue([
      // Bob's paired doc grant (allow) — the one to delete.
      { id: 'bob-doc', subject_type: 'user', subject_id: 'bob', target_scope: 'collection', resource_type: 'document', filter: docFilter, capability: 'write' },
      // Bob's *deny* doc grant — same subject, different effect: must NOT match.
      { id: 'bob-doc-deny', subject_type: 'user', subject_id: 'bob', target_scope: 'collection', resource_type: 'document', filter: docFilter, capability: 'manage', effect: 'deny' },
      // Alice's doc grant — different subject: must NOT match.
      { id: 'alice-doc', subject_type: 'user', subject_id: 'alice', target_scope: 'collection', resource_type: 'document', filter: docFilter, capability: 'write' },
    ] as AccessGrantRecord[] as never);

    const revokedRecordGrant: AccessGrantRecord = {
      id: 'bob-rec',
      subject_type: 'user',
      subject_id: 'bob',
      target_scope: 'record',
      resource_type: 'collection',
      resource_id: 'c1',
      capability: 'write',
    };

    const { result } = renderHook(() => useUnshareCollectionDocuments(), { wrapper: createWrapper() });
    await result.current.mutateAsync({ collectionId: 'c1', grant: revokedRecordGrant });

    expect(aepbase.remove).toHaveBeenCalledWith(ACCESS_GRANTS, 'bob-doc');
    expect(aepbase.remove).toHaveBeenCalledTimes(1);
  });
});
