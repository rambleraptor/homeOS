/**
 * Create or rename a collection: name, optional description, and a colour for
 * the folder chip. A thin form over the collection CRUD hooks.
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '@rambleraptor/homestead-core/shared/components/Modal';
import { Button } from '@rambleraptor/homestead-core/shared/components/Button';
import {
  useCreateCollection,
  useUpdateCollection,
  type CollectionInput,
} from '../hooks/useCollections';
import type { Collection } from '../types';

/** A small preset palette for folder chips (kept legible on a white row). */
export const COLLECTION_COLORS = [
  '#2563eb', // blue
  '#16a34a', // green
  '#d97706', // amber
  '#dc2626', // red
  '#7c3aed', // violet
  '#0891b2', // cyan
  '#db2777', // pink
  '#4b5563', // slate
] as const;

interface CollectionFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** When present, the dialog edits this collection; otherwise it creates one. */
  collection?: Collection;
  /** Called with the created/updated collection id on success. */
  onSaved?: (id: string) => void;
}

export function CollectionFormDialog({
  isOpen,
  onClose,
  collection,
  onSaved,
}: CollectionFormDialogProps) {
  const editing = !!collection;
  const [name, setName] = useState(collection?.name ?? '');
  const [description, setDescription] = useState(collection?.description ?? '');
  const [color, setColor] = useState<string>(collection?.color ?? COLLECTION_COLORS[0]);

  const create = useCreateCollection();
  const update = useUpdateCollection();
  const isSaving = create.isPending || update.isPending;
  const error = create.error ?? update.error;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const input: CollectionInput = {
      name: trimmed,
      description: description.trim() || undefined,
      color,
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: collection.id, patch: input });
        onSaved?.(collection.id);
      } else {
        const created = await create.mutateAsync(input);
        onSaved?.(created.id);
      }
      onClose();
    } catch {
      // Error surfaced below; keep the dialog open.
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? 'Rename collection' : 'New collection'}
    >
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="collection-form">
        <div>
          <label htmlFor="collection-name" className="block text-xs font-medium text-gray-700">
            Name
          </label>
          <input
            id="collection-name"
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            data-testid="collection-name-input"
          />
        </div>

        <div>
          <label htmlFor="collection-description" className="block text-xs font-medium text-gray-700">
            Description <span className="text-gray-400">(optional)</span>
          </label>
          <input
            id="collection-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            data-testid="collection-description-input"
          />
        </div>

        <div>
          <span className="block text-xs font-medium text-gray-700">Colour</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {COLLECTION_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full border-2 ${
                  color === c ? 'border-gray-900' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
                data-testid={`collection-color-${c}`}
              />
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600" data-testid="collection-form-error">
            {error instanceof Error ? error.message : 'Could not save the collection.'}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving || !name.trim()} data-testid="collection-form-save">
            {isSaving && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}
            {editing ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
