/**
 * Collections: folder-like groupings of documents, plus the sharing that rides
 * on the permissions system.
 *
 * Membership lives on the document (`Document.collections`), so this file owns
 * collection CRUD, a membership setter, and the sharing wrappers. Sharing is
 * *not* custom machinery — it writes ordinary `access-grant` records:
 *   1. a record-scope grant on the `collection` (so the sharee sees the folder)
 *   2. a collection-scope grant on `document` filtered by `'<id>' in collections`
 *      (so the sharee sees the documents in it — this is what the engine's `in`
 *      operator enables).
 * Revoking deletes those grants. The engine's manage-on-target rule authorizes
 * the writes, so a plain member can create/organize collections but only
 * someone who can manage documents (a superuser/admin) can actually share.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { queryClient, queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { ACCESS_GRANTS } from '@rambleraptor/homestead-core/permissions/resources';
import type { AccessGrantRecord } from '@rambleraptor/homestead-core/permissions/hooks';
import type { Capability, Effect } from '@rambleraptor/homestead-core/permissions/resolve';
import { logger } from '@rambleraptor/homestead-core/utils/logger';
import { COLLECTIONS } from '../resources';
import type { Collection } from '../types';
import { invalidateDocuments } from './useDocuments';

export const collectionKeys = queryKeys.app('documents').resource('collection');

/** The document-visibility grant filter for a collection: `'<id>' in collections`. */
export function collectionDocumentFilter(collectionId: string): string {
  return `'${collectionId}' in collections`;
}

/** Alphabetical by name. */
export function useCollections() {
  return useQuery({
    queryKey: collectionKeys.list(),
    queryFn: async () => {
      const collections = await aepbase.list<Collection>(COLLECTIONS);
      return [...collections].sort((a, b) =>
        (a.name ?? '').localeCompare(b.name ?? ''),
      );
    },
  });
}

async function invalidateCollections(): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: collectionKeys.all() });
}

export interface CollectionInput {
  name: string;
  description?: string;
  color?: string;
}

export function useCreateCollection() {
  return useMutation({
    mutationFn: async (input: CollectionInput): Promise<Collection> => {
      const created = await aepbase.create<Collection>(COLLECTIONS, {
        name: input.name,
        description: input.description,
        color: input.color,
        created_by: aepbase.getCurrentUser()?.id,
      });
      await invalidateCollections();
      return created;
    },
    onError: (error) => logger.error('Failed to create collection', error),
  });
}

export function useUpdateCollection() {
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<CollectionInput>;
    }): Promise<Collection> => {
      const updated = await aepbase.update<Collection>(COLLECTIONS, id, patch);
      await invalidateCollections();
      return updated;
    },
    onError: (error) => logger.error('Failed to update collection', error),
  });
}

export function useDeleteCollection() {
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      // The `collections` reference declares onDelete: set-null, so the engine
      // drops this id from every document's membership array on delete. Any
      // share grants are cleaned up by the caller (unshare) before deleting.
      await aepbase.remove(COLLECTIONS, id);
      await invalidateCollections();
      await invalidateDocuments();
    },
    onError: (error) => logger.error('Failed to delete collection', error),
  });
}

/**
 * Replace a document's collection membership. Merge-patch replaces the whole
 * array, so callers pass the full desired set (see `toggleMembership`).
 */
export function useSetDocumentCollections() {
  return useMutation({
    mutationFn: async ({
      documentId,
      collections,
    }: {
      documentId: string;
      collections: string[];
    }): Promise<void> => {
      const { DOCUMENTS } = await import('../resources');
      await aepbase.update(DOCUMENTS, documentId, { collections });
      await invalidateDocuments();
    },
    onError: (error) => logger.error('Failed to update document collections', error),
  });
}

/** Add or remove `collectionId` from a membership list, returning a new array. */
export function toggleMembership(
  current: string[] | undefined,
  collectionId: string,
  member: boolean,
): string[] {
  const set = new Set(current ?? []);
  if (member) set.add(collectionId);
  else set.delete(collectionId);
  return [...set];
}

// ─────────────────────────── Sharing ───────────────────────────

export interface CollectionShare {
  /** Grant id on the collection record (folder visibility). */
  recordGrantId: string;
  /** Grant id on the document filter (document access), if present. */
  documentGrantId?: string;
  subject_type: 'user' | 'group' | 'everyone';
  subject_id?: string;
  capability: Capability;
  /** 'allow' shares access; 'deny' blocks the subject from the folder + its docs. */
  effect: Effect;
}

const shareKeys = {
  forCollection: (id: string) => ['documents', 'collection-shares', id] as const,
};

/**
 * Who a collection is shared with. Pairs each collection-record grant with its
 * matching document filter grant (by subject) so the UI can revoke both.
 */
export function useCollectionShares(collectionId: string | undefined) {
  return useQuery({
    queryKey: shareKeys.forCollection(collectionId ?? ''),
    enabled: !!collectionId,
    queryFn: async (): Promise<CollectionShare[]> => {
      const grants = await aepbase.list<AccessGrantRecord>(ACCESS_GRANTS);
      const docFilter = collectionDocumentFilter(collectionId!);
      const recordGrants = grants.filter(
        (g) =>
          g.target_scope === 'record' &&
          g.resource_type === 'collection' &&
          g.resource_id === collectionId,
      );
      const docGrants = grants.filter(
        (g) =>
          g.target_scope === 'collection' &&
          g.resource_type === 'document' &&
          g.filter === docFilter,
      );
      // Key by subject *and* effect so an allow and a deny for the same person
      // pair with their own document grant instead of colliding.
      const effectOf = (g: AccessGrantRecord): Effect => g.effect ?? 'allow';
      const subjectKey = (g: AccessGrantRecord) =>
        `${g.subject_type}:${g.subject_id ?? ''}:${effectOf(g)}`;
      const docBySubject = new Map(docGrants.map((g) => [subjectKey(g), g]));
      return recordGrants.map((rg) => {
        const dg = docBySubject.get(subjectKey(rg));
        return {
          recordGrantId: rg.id,
          documentGrantId: dg?.id,
          subject_type: rg.subject_type,
          subject_id: rg.subject_id,
          capability: rg.capability,
          effect: effectOf(rg),
        };
      });
    },
  });
}

export interface ShareCollectionInput {
  collectionId: string;
  subject: { type: 'user' | 'group'; id: string };
  /** 'read' = view only; 'write' = view + add/remove + edit. Defaults to 'write'. */
  capability?: Capability;
  /**
   * 'allow' (default) shares the collection; 'deny' blocks the subject from the
   * folder and its documents even against a broader allow (deny always wins). A
   * block is written at `manage` so it beats an allow at any capability.
   */
  effect?: Effect;
}

/**
 * Share a collection: one record grant on the collection (folder), one
 * collection-scope filter grant on documents. Both go through the ordinary
 * access-grant resource; the engine authorizes them (manage-on-target).
 */
export function useShareCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ShareCollectionInput): Promise<void> => {
      const isDeny = input.effect === 'deny';
      const capability = input.capability ?? (isDeny ? 'manage' : 'write');
      const subjectFields = {
        subject_type: input.subject.type,
        subject_id: input.subject.id,
        capability,
        // Only stamp effect for a deny; the wire schema defaults to allow, so an
        // allow share stays byte-identical to the pre-deny payload.
        ...(isDeny ? { effect: 'deny' as const } : {}),
      };
      await aepbase.create<AccessGrantRecord>(ACCESS_GRANTS, {
        ...subjectFields,
        target_scope: 'record',
        resource_type: 'collection',
        resource_id: input.collectionId,
      });
      await aepbase.create<AccessGrantRecord>(ACCESS_GRANTS, {
        ...subjectFields,
        target_scope: 'collection',
        resource_type: 'document',
        filter: collectionDocumentFilter(input.collectionId),
      });
    },
    onSuccess: (_data, input) =>
      qc.invalidateQueries({ queryKey: shareKeys.forCollection(input.collectionId) }),
    onError: (error) => logger.error('Failed to share collection', error),
  });
}

/** Revoke a share: delete the paired record + document grants. */
export function useUnshareCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      share,
    }: {
      collectionId: string;
      share: CollectionShare;
    }): Promise<void> => {
      await aepbase.remove(ACCESS_GRANTS, share.recordGrantId);
      if (share.documentGrantId) {
        await aepbase.remove(ACCESS_GRANTS, share.documentGrantId);
      }
    },
    onSuccess: (_data, input) =>
      qc.invalidateQueries({ queryKey: shareKeys.forCollection(input.collectionId) }),
    onError: (error) => logger.error('Failed to unshare collection', error),
  });
}
