/**
 * HSA Home Component
 *
 * Main interface for managing unreimbursed medical expenses.
 */

import { useState } from 'react';
import { Loader2, AlertCircle, Plus } from 'lucide-react';
import { useHSAStats } from '../hooks/useHSAStats';
import { useCreateHSAReceipt } from '../hooks/useCreateHSAReceipt';
import { useUpdateHSAReceipt } from '../hooks/useUpdateHSAReceipt';
import { useDeleteHSAReceipt } from '../hooks/useDeleteHSAReceipt';
import { HSAKPICard } from './HSAKPICard';
import { HSAStatTiles } from './HSAStatTiles';
import { HSACategoryBreakdown } from './HSACategoryBreakdown';
import { HSAQuickCaptureForm } from './HSAQuickCaptureForm';
import { HSAReceiptEditForm } from './HSAReceiptEditForm';
import { HSAAuditVault } from './HSAAuditVault';
import { HSAEmptyState } from './HSAEmptyState';
import { ConfirmDialog } from '@rambleraptor/homestead-core/shared/components/ConfirmDialog';
import { Modal } from '@rambleraptor/homestead-core/shared/components/Modal';
import { PageHeader } from '@rambleraptor/homestead-core/shared/components/PageHeader';
import { Button } from '@rambleraptor/homestead-core/shared/components/Button';
import { logger } from '@rambleraptor/homestead-core/utils/logger';
import type { HSAReceipt, HSAReceiptFormData, ReceiptStatus } from '../types';

export function HSAHome() {
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<string | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<HSAReceipt | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReceiptStatus | 'All'>('All');

  const { stats, isLoading, isError, error } = useHSAStats();
  const createMutation = useCreateHSAReceipt();
  const updateMutation = useUpdateHSAReceipt();
  const deleteMutation = useDeleteHSAReceipt();

  const handleFormSubmit = async (data: HSAReceiptFormData) => {
    try {
      await createMutation.mutateAsync(data);
      setShowForm(false);
    } catch (err) {
      logger.error('Failed to create HSA receipt', err);
    }
  };

  const handleEditSubmit = async (data: Partial<HSAReceipt>) => {
    if (!editingReceipt) return;
    await updateMutation.mutateAsync({ id: editingReceipt.id, data });
    setEditingReceipt(null);
  };

  const handleMarkAsReimbursed = async (id: string) => {
    try {
      await updateMutation.mutateAsync({
        id,
        data: { status: 'Reimbursed' },
      });
    } catch (err) {
      logger.error('Failed to mark receipt as reimbursed', err);
    }
  };

  const handleDeleteReceipt = (id: string) => {
    setReceiptToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (receiptToDelete) {
      await deleteMutation.mutateAsync(receiptToDelete);
      setDeleteConfirmOpen(false);
      setReceiptToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-accent-terracotta animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50/40 p-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-900">
              Failed to load HSA receipts
            </h3>
            <p className="text-sm text-red-700">
              {error instanceof Error ? error.message : 'An error occurred'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const hasReceipts = !!stats && stats.totalReceipts > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="HSA Receipts"
        subtitle="Track unreimbursed medical expenses"
        actions={
          <Button
            data-testid="add-hsa-receipt-button"
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-4 w-4" />
            Add receipt
          </Button>
        }
      />

      {stats && (
        <HSAKPICard
          totalStored={stats.totalStored}
          storedReceipts={stats.storedReceipts}
        />
      )}

      {stats && !hasReceipts && (
        <HSAEmptyState onAdd={() => setShowForm(true)} />
      )}

      {stats && hasReceipts && (
        <>
          <HSAStatTiles stats={stats} />

          {stats.categoryBreakdown.length > 0 && (
            <HSACategoryBreakdown breakdown={stats.categoryBreakdown} />
          )}

          <HSAAuditVault
            stats={stats}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onMarkAsReimbursed={handleMarkAsReimbursed}
            onEdit={setEditingReceipt}
            onDelete={handleDeleteReceipt}
            isUpdating={updateMutation.isPending}
          />
        </>
      )}

      {/* Quick capture (modal) */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Add Receipt"
      >
        <HSAQuickCaptureForm
          onSubmit={handleFormSubmit}
          onCancel={() => setShowForm(false)}
          isSubmitting={createMutation.isPending}
        />
      </Modal>

      <Modal
        isOpen={editingReceipt !== null}
        onClose={() => setEditingReceipt(null)}
        title="Edit Receipt"
      >
        {editingReceipt && (
          <HSAReceiptEditForm
            receipt={editingReceipt}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditingReceipt(null)}
            isSubmitting={updateMutation.isPending}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Receipt"
        message="Are you sure you want to delete this receipt? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* Mobile quick-add: a thumb-reachable floating action button. */}
      <button
        onClick={() => setShowForm(true)}
        aria-label="Add receipt"
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent-terracotta text-white shadow-lg transition-colors hover:bg-accent-terracotta-hover md:hidden"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
