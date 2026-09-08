/**
 * Groceries List Component
 *
 * Data-backed wrapper around `GroceryList` that owns its own fetching,
 * toggle/delete wiring, and store-complete confirmation. Used by
 * `GroceriesHome` — it deliberately omits the page header, quick-add,
 * notify, upload, new-list and store-management controls.
 */

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { SkeletonList } from '@rambleraptor/homestead-core/shared/components/Skeleton';
import { useGroupedGroceries } from '../hooks/useGroupedGroceries';
import { useUpdateGroceryItem } from '../hooks/useUpdateGroceryItem';
import { useDeleteGroceryItem } from '../hooks/useDeleteGroceryItem';
import { useCreateGroceryItem } from '../hooks/useCreateGroceryItem';
import { useMarkStoreCompleted } from '../hooks/useMarkStoreCompleted';
import { useStoreCelebration } from '../hooks/useStoreCelebration';
import { GroceryList } from './GroceryList';
import { StoreConfetti } from './StoreConfetti';
import { ConfirmDialog } from '@rambleraptor/homestead-core/shared/components/ConfirmDialog';
import { useToast } from '@rambleraptor/homestead-core/shared/components/ToastProvider';
import { useOnlineStatus } from '@rambleraptor/homestead-core/shared/hooks/useOnlineStatus';
import { logger } from '@rambleraptor/homestead-core/utils/logger';

export function GroceriesList() {
  const [storeToClear, setStoreToClear] = useState<{ id: string | null; name: string } | null>(null);

  const { stats, isLoading, isError, error } = useGroupedGroceries();
  const updateMutation = useUpdateGroceryItem();
  const deleteMutation = useDeleteGroceryItem();
  const createMutation = useCreateGroceryItem();
  const markStoreCompletedMutation = useMarkStoreCompleted();
  const { isOffline } = useOnlineStatus();
  const toast = useToast();
  // Checking an item that finishes off a whole store's list: the shared
  // celebration toast carries the message, the confetti overlay is the
  // fanfare. Watches the grouped stats, so the optimistic cache update fires
  // it instantly.
  const celebration = useStoreCelebration(stats.stores, (storeName) =>
    toast.celebrate(`${storeName} complete!`, {
      description: 'Every item checked off — nice work!',
    }),
  );

  // Fire-and-forget — optimistic onMutate updates the cache synchronously,
  // so awaiting the mutation would just leak a hanging promise when the
  // mutation pauses while offline.
  const handleToggleItem = (id: string, checked: boolean) => {
    updateMutation.mutate({ id, data: { checked } });
  };

  // Deleting an item used to be instant, silent, and unrecoverable — one
  // mis-tap next to the checkbox and it was simply gone, with nothing on
  // screen to say so. The toast both confirms it happened and offers the way
  // back. Undo recreates the item rather than cancelling the delete, so the
  // restored row carries a new id; nothing references a grocery item, so that
  // is invisible here (see `ToastProvider.undo` for when it wouldn't be).
  const handleDeleteItem = (id: string) => {
    const item = stats.stores
      .flatMap((group) => group.items)
      .find((candidate) => candidate.id === id);

    deleteMutation.mutate(id);

    if (!item) return;
    toast.undo(`Deleted ${item.name}`, () => {
      createMutation.mutate({
        name: item.name,
        notes: item.notes,
        store: item.store,
        checked: item.checked,
      });
    });
  };

  const handleMarkStoreCompleted = (storeId: string | null) => {
    const storeGroup = stats.stores.find((s) => (s.store?.id || null) === storeId);
    const storeName = storeGroup?.store?.name || 'No Store';
    setStoreToClear({ id: storeId, name: storeName });
  };

  const handleConfirmStoreClear = async () => {
    if (!storeToClear) return;
    try {
      const result = await markStoreCompletedMutation.mutateAsync({ storeId: storeToClear.id });
      logger.info(`Deleted ${result.deleted} items from completed store`);
      setStoreToClear(null);
    } catch (err) {
      logger.error('Failed to mark store as completed', err);
    }
  };

  if (isLoading) {
    return (
      <SkeletonList
        rows={6}
        showLeading
        label="Loading groceries"
        data-testid="groceries-loading"
      />
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50/20 border border-red-200 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-900">Failed to load groceries</h3>
            <p className="text-sm text-red-700">
              {error instanceof Error ? error.message : 'An error occurred'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isBulkUpdating = markStoreCompletedMutation.isPending;

  return (
    <>
      <GroceryList
        storeGroups={stats.stores}
        onToggleItem={handleToggleItem}
        onDeleteItem={handleDeleteItem}
        onMarkStoreCompleted={handleMarkStoreCompleted}
        // Mark Complete is a bulk delete — online-only, like New List.
        isUpdating={isBulkUpdating || isOffline}
      />

      <ConfirmDialog
        isOpen={storeToClear !== null}
        onClose={() => setStoreToClear(null)}
        onConfirm={handleConfirmStoreClear}
        title={`Clear ${storeToClear?.name ?? 'Store'}`}
        message={`Are you sure you want to clear all items from ${storeToClear?.name ?? 'this store'}? This action cannot be undone.`}
        confirmLabel="Clear Store"
        variant="danger"
        isLoading={markStoreCompletedMutation.isPending}
      />

      {celebration && <StoreConfetti key={celebration.key} />}
    </>
  );
}
