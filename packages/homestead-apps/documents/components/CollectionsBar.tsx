/**
 * The folder-like row of collections at the top of the documents page. Chips
 * filter the list; a manager can create, rename, share, and delete collections
 * from here. Membership itself is edited per-document (see DocumentEditForm).
 */

import { useMemo, useState } from 'react';
import { FolderPlus, Pencil, Share2, Trash2 } from 'lucide-react';
import { useCan } from '@rambleraptor/homestead-core/permissions/useCan';
import { ConfirmDialog } from '@rambleraptor/homestead-core/shared/components/ConfirmDialog';
import { useCollections, useDeleteCollection } from '../hooks/useCollections';
import type { Collection, Document } from '../types';
import { CollectionFormDialog } from './CollectionFormDialog';
import { CollectionShareDialog } from './CollectionShareDialog';

/** Selection: null = all documents; 'unfiled' = no collection; else a collection id. */
export type CollectionSelection = string | null;
export const UNFILED = 'unfiled';

interface CollectionsBarProps {
  documents: Document[];
  selected: CollectionSelection;
  onSelect: (selection: CollectionSelection) => void;
}

export function CollectionsBar({ documents, selected, onSelect }: CollectionsBarProps) {
  const { data: collections } = useCollections();
  const can = useCan();
  const canManageDocuments = can('manage', 'document', { appId: 'documents' });
  const deleteCollection = useDeleteCollection();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [sharing, setSharing] = useState<Collection | null>(null);
  const [deleting, setDeleting] = useState<Collection | null>(null);

  const counts = useMemo(() => {
    const byId = new Map<string, number>();
    let unfiled = 0;
    for (const doc of documents) {
      const ids = doc.collections ?? [];
      if (ids.length === 0) unfiled += 1;
      for (const id of ids) byId.set(id, (byId.get(id) ?? 0) + 1);
    }
    return { byId, unfiled };
  }, [documents]);

  const list = collections ?? [];
  const activeCollection = list.find((c) => c.id === selected) ?? null;

  const chipClass = (isActive: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
      isActive
        ? 'border-gray-900 bg-gray-900 text-white'
        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
    }`;

  const handleDelete = async () => {
    if (!deleting) return;
    await deleteCollection.mutateAsync(deleting.id);
    if (selected === deleting.id) onSelect(null);
    setDeleting(null);
  };

  return (
    <div className="space-y-2" data-testid="collections-bar">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={chipClass(selected === null)}
          onClick={() => onSelect(null)}
          data-testid="collection-chip-all"
        >
          All documents
        </button>

        {list.map((c) => {
          const isActive = selected === c.id;
          return (
            <button
              key={c.id}
              type="button"
              className={chipClass(isActive)}
              onClick={() => onSelect(c.id)}
              data-testid={`collection-chip-${c.id}`}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: c.color || '#4b5563' }}
              />
              {c.name}
              <span className={isActive ? 'text-gray-300' : 'text-gray-400'}>
                {counts.byId.get(c.id) ?? 0}
              </span>
            </button>
          );
        })}

        {counts.unfiled > 0 && (
          <button
            type="button"
            className={chipClass(selected === UNFILED)}
            onClick={() => onSelect(UNFILED)}
            data-testid="collection-chip-unfiled"
          >
            Unfiled
            <span className={selected === UNFILED ? 'text-gray-300' : 'text-gray-400'}>
              {counts.unfiled}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-gray-300 px-3 py-1 text-sm text-gray-500 hover:bg-gray-50"
          data-testid="collection-new"
        >
          <FolderPlus className="h-4 w-4" />
          New collection
        </button>
      </div>

      {/* Actions for the selected collection */}
      {activeCollection && (
        <div className="flex items-center gap-4 text-sm text-gray-500" data-testid="collection-actions">
          {activeCollection.description && (
            <span className="text-gray-400">{activeCollection.description}</span>
          )}
          <button
            type="button"
            className="inline-flex items-center gap-1 hover:text-gray-800"
            onClick={() => setEditing(activeCollection)}
            data-testid="collection-rename"
          >
            <Pencil className="h-3.5 w-3.5" /> Rename
          </button>
          {canManageDocuments && (
            <button
              type="button"
              className="inline-flex items-center gap-1 hover:text-gray-800"
              onClick={() => setSharing(activeCollection)}
              data-testid="collection-share"
            >
              <Share2 className="h-3.5 w-3.5" /> Share
            </button>
          )}
          <button
            type="button"
            className="inline-flex items-center gap-1 hover:text-red-600"
            onClick={() => setDeleting(activeCollection)}
            data-testid="collection-delete"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}

      {creating && (
        <CollectionFormDialog
          isOpen
          onClose={() => setCreating(false)}
          onSaved={(id) => onSelect(id)}
        />
      )}
      {editing && (
        <CollectionFormDialog
          isOpen
          collection={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {sharing && (
        <CollectionShareDialog
          isOpen
          collection={sharing}
          onClose={() => setSharing(null)}
        />
      )}
      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
        title="Delete collection"
        message={
          deleting
            ? `Delete “${deleting.name}”? The documents in it are kept — they're just removed from this collection.`
            : ''
        }
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteCollection.isPending}
      />
    </div>
  );
}
