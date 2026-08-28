/**
 * The folder-like row of collections at the top of the documents page. Chips
 * filter the list; a manager can create, rename, share, and delete collections
 * from here. Membership itself is edited per-document (see DocumentEditForm).
 *
 * The selected chip carries its own overflow menu rather than revealing a row
 * of text links beneath the bar. Those links pushed the whole page down the
 * moment a folder was picked — a layout shift caused by *selecting* something,
 * which reads as the page breaking rather than responding — and three bare
 * links in muted grey didn't look like the destructive actions two of them are.
 * A menu on the chip keeps the actions where their subject is, and keeps the
 * bar's height fixed.
 */

import { useMemo, useRef, useState } from 'react';
import { FolderPlus, MoreHorizontal, Pencil, Share2, Trash2 } from 'lucide-react';
import { useCan } from '@rambleraptor/homestead-core/permissions/useCan';
import { ConfirmDialog } from '@rambleraptor/homestead-core/shared/components/ConfirmDialog';
import { TickingCount } from '@rambleraptor/homestead-core/shared/components/TickingCount';
import { useDismissOnOutside } from '@rambleraptor/homestead-core/shared/hooks/useDismissOnOutside';
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

/** The pill shell — worn by a plain chip and by the selected chip's group alike. */
function chipShell(isActive: boolean): string {
  return `inline-flex items-center rounded-full border text-sm transition-colors ${
    isActive
      ? 'border-accent-terracotta bg-accent-terracotta text-white'
      : 'border-gray-200 bg-surface-white text-brand-slate hover:bg-bg-pearl'
  }`;
}

const CHIP_BUTTON = 'inline-flex items-center gap-1.5 px-3 py-1';

export function CollectionsBar({ documents, selected, onSelect }: CollectionsBarProps) {
  const { data: collections } = useCollections();
  const can = useCan();
  const canManageDocuments = can('manage', 'document', { appId: 'documents' });
  const deleteCollection = useDeleteCollection();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [sharing, setSharing] = useState<Collection | null>(null);
  const [deleting, setDeleting] = useState<Collection | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLSpanElement>(null);

  useDismissOnOutside(menuRef, menuOpen, () => setMenuOpen(false));

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

  const select = (selection: CollectionSelection) => {
    setMenuOpen(false);
    onSelect(selection);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await deleteCollection.mutateAsync(deleting.id);
    if (selected === deleting.id) onSelect(null);
    setDeleting(null);
  };

  const menuItem =
    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-brand-slate transition-colors hover:bg-bg-pearl';

  return (
    <div className="space-y-2" data-testid="collections-bar">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`${chipShell(selected === null)} ${CHIP_BUTTON}`}
          onClick={() => select(null)}
          data-testid="collection-chip-all"
        >
          All documents
        </button>

        {list.map((c) => {
          const isActive = selected === c.id;
          const chip = (
            <button
              type="button"
              className={CHIP_BUTTON}
              onClick={() => select(c.id)}
              data-testid={`collection-chip-${c.id}`}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: c.color || '#4b5563' }}
              />
              {c.name}
              <span className={isActive ? 'text-white/70' : 'text-gray-400'}>
                <TickingCount value={counts.byId.get(c.id) ?? 0} />
              </span>
            </button>
          );

          // Only the selected chip carries the menu: the actions all act on the
          // collection in view, and a ⋯ on every chip would be nine of them.
          if (!isActive) {
            return (
              <span key={c.id} className={chipShell(false)}>
                {chip}
              </span>
            );
          }

          return (
            <span key={c.id} ref={menuRef} className={`relative ${chipShell(true)}`}>
              {chip}
              <span className="h-4 w-px bg-white/30" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={`Actions for ${c.name}`}
                data-testid="collection-menu"
                className="rounded-full px-2 py-1 transition-colors hover:bg-white/20"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  data-testid="collection-menu-items"
                  className="animate-menu-in absolute right-0 top-full z-10 mt-1 w-44 origin-top-right rounded-xl border border-gray-200 bg-surface-white p-1 shadow-md"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className={menuItem}
                    onClick={() => {
                      setMenuOpen(false);
                      setEditing(c);
                    }}
                    data-testid="collection-rename"
                  >
                    <Pencil className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Rename
                  </button>
                  {canManageDocuments && (
                    <button
                      type="button"
                      role="menuitem"
                      className={menuItem}
                      onClick={() => {
                        setMenuOpen(false);
                        setSharing(c);
                      }}
                      data-testid="collection-share"
                    >
                      <Share2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                      Share
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    className={`${menuItem} text-red-600 hover:bg-red-50`}
                    onClick={() => {
                      setMenuOpen(false);
                      setDeleting(c);
                    }}
                    data-testid="collection-delete"
                  >
                    <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Delete
                  </button>
                </div>
              )}
            </span>
          );
        })}

        {counts.unfiled > 0 && (
          <button
            type="button"
            className={`${chipShell(selected === UNFILED)} ${CHIP_BUTTON}`}
            onClick={() => select(UNFILED)}
            data-testid="collection-chip-unfiled"
          >
            Unfiled
            <span className={selected === UNFILED ? 'text-white/70' : 'text-gray-400'}>
              <TickingCount value={counts.unfiled} />
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-gray-300 px-3 py-1 text-sm text-text-muted transition-colors hover:bg-bg-pearl"
          data-testid="collection-new"
        >
          <FolderPlus className="h-4 w-4" />
          New collection
        </button>
      </div>

      {activeCollection?.description && (
        <p className="text-sm text-text-muted" data-testid="collection-description">
          {activeCollection.description}
        </p>
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
