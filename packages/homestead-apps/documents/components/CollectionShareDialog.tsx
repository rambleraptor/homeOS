/**
 * Share a collection with household members. Lists who it's shared with and
 * lets a manager add or revoke access. Sharing writes ordinary access-grants
 * (see useCollections) — this dialog is only shown to callers who can manage
 * documents, since the engine's manage-on-target rule is what authorizes the
 * document grant.
 */

import { useMemo, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { Modal } from '@rambleraptor/homestead-core/shared/components/Modal';
import { Button } from '@rambleraptor/homestead-core/shared/components/Button';
import { useAllUsers, bareId } from '@rambleraptor/homestead-core/permissions/hooks';
import type { Capability } from '@rambleraptor/homestead-core/permissions/resolve';
import {
  useCollectionShares,
  useShareCollection,
  useUnshareCollection,
  type CollectionShare,
} from '../hooks/useCollections';
import type { Collection } from '../types';

interface CollectionShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  collection: Collection;
}

const CAPABILITY_LABEL: Record<Capability, string> = {
  read: 'View',
  write: 'Can edit',
  manage: 'Full access',
};

export function CollectionShareDialog({
  isOpen,
  onClose,
  collection,
}: CollectionShareDialogProps) {
  const { data: shares, isLoading } = useCollectionShares(collection.id);
  const { data: users } = useAllUsers();
  const share = useShareCollection();
  const unshare = useUnshareCollection();

  const [userId, setUserId] = useState('');
  const [capability, setCapability] = useState<Capability>('write');

  const currentUserId = bareId(collection.created_by ?? '');
  // People not already shared with (and not the owner) are candidates to add.
  const sharedUserIds = useMemo(
    () => new Set((shares ?? []).filter((s) => s.subject_type === 'user').map((s) => s.subject_id)),
    [shares],
  );
  const candidates = (users ?? []).filter(
    (u) => u.id !== currentUserId && !sharedUserIds.has(u.id),
  );

  const nameFor = (id: string | undefined) => {
    const u = (users ?? []).find((x) => x.id === id);
    return u?.display_name || u?.email || id || 'Someone';
  };

  const handleAdd = async () => {
    if (!userId) return;
    await share.mutateAsync({
      collectionId: collection.id,
      subject: { type: 'user', id: userId },
      capability,
    });
    setUserId('');
  };

  const handleRevoke = (s: CollectionShare) =>
    unshare.mutateAsync({ collectionId: collection.id, share: s });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Share “${collection.name}”`}>
      <div className="space-y-5" data-testid="collection-share-dialog">
        <p className="text-sm text-gray-500">
          People you share this collection with can see the folder and the documents in it.
        </p>

        {/* Add a person */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[10rem]">
            <label htmlFor="share-user" className="block text-xs font-medium text-gray-700">
              Add a person
            </label>
            <select
              id="share-user"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              data-testid="collection-share-user"
            >
              <option value="">Select someone…</option>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.display_name || u.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="share-capability" className="block text-xs font-medium text-gray-700">
              Access
            </label>
            <select
              id="share-capability"
              value={capability}
              onChange={(e) => setCapability(e.target.value as Capability)}
              className="mt-1 block rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              data-testid="collection-share-capability"
            >
              <option value="read">View</option>
              <option value="write">Can edit</option>
            </select>
          </div>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={!userId || share.isPending}
            data-testid="collection-share-add"
          >
            {share.isPending && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}
            Share
          </Button>
        </div>

        {share.error && (
          <p className="text-sm text-red-600" data-testid="collection-share-error">
            {share.error instanceof Error ? share.error.message : 'Could not share the collection.'}
          </p>
        )}

        {/* Current shares */}
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wide text-gray-500">Shared with</h4>
          {isLoading ? (
            <div className="py-4 text-center">
              <Loader2 className="inline h-4 w-4 animate-spin text-gray-400" />
            </div>
          ) : (shares ?? []).length === 0 ? (
            <p className="py-3 text-sm text-gray-500" data-testid="collection-share-empty">
              Not shared with anyone yet.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-100" data-testid="collection-share-list">
              {(shares ?? []).map((s) => (
                <li key={s.recordGrantId} className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-800">
                    {s.subject_type === 'user' ? nameFor(s.subject_id) : `Group ${s.subject_id}`}
                    <span className="ml-2 text-xs text-gray-400">
                      {CAPABILITY_LABEL[s.capability]}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleRevoke(s)}
                    disabled={unshare.isPending}
                    className="inline-flex items-center gap-1 rounded p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
                    aria-label="Revoke access"
                    data-testid={`collection-share-revoke-${s.subject_id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
