/**
 * Share a collection with household members or groups.
 *
 * A thin wrapper over the generic ShareRecordDialog: the dialog owns the
 * collection *record* grant (folder visibility) and the shared-with list, while
 * this supplies the documents-specific cascade — the collection-scope
 * `in`-filter grant on documents — through the onShare/onRevoke seam, so a
 * sharee also sees the documents in the folder. The engine's manage-on-target
 * rule authorizes both writes.
 */

import {
  ShareRecordDialog,
  type ShareSubject,
  type ShareDetails,
} from '@rambleraptor/homestead-core/permissions/components/ShareRecordDialog';
import type { AccessGrantRecord } from '@rambleraptor/homestead-core/permissions/hooks';
import {
  useShareCollectionDocuments,
  useUnshareCollectionDocuments,
} from '../hooks/useCollections';
import type { Collection } from '../types';

interface CollectionShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  collection: Collection;
}

export function CollectionShareDialog({
  isOpen,
  onClose,
  collection,
}: CollectionShareDialogProps) {
  const shareDocs = useShareCollectionDocuments();
  const unshareDocs = useUnshareCollectionDocuments();

  const handleShare = (subject: ShareSubject, details: ShareDetails) =>
    shareDocs.mutateAsync({
      collectionId: collection.id,
      subject,
      capability: details.capability,
      effect: details.effect,
    });

  const handleRevoke = (grant: AccessGrantRecord) =>
    unshareDocs.mutateAsync({ collectionId: collection.id, grant });

  return (
    <ShareRecordDialog
      isOpen={isOpen}
      onClose={onClose}
      // The record grant is stored on the `collection` singular.
      resourceType="collection"
      recordId={collection.id}
      recordName={collection.name}
      ownerId={collection.created_by}
      appId="documents"
      onShare={handleShare}
      onRevoke={handleRevoke}
    />
  );
}
