/**
 * Health Home
 *
 * The user's own vaccination records — list view with inline create / edit
 * form swap, a due-soon strip, and delete confirmation. Records are private
 * per user (see `resources.ts`), so everything on this page belongs to the
 * signed-in user only.
 */

import { useMemo, useState } from 'react';
import { AlertCircle, Plus, ShieldCheck } from 'lucide-react';
import { SkeletonPage } from '@rambleraptor/homestead-core/shared/components/Skeleton';
import { ConfirmDialog } from '@rambleraptor/homestead-core/shared/components/ConfirmDialog';
import { PageHeader } from '@rambleraptor/homestead-core/shared/components/PageHeader';
import { logger } from '@rambleraptor/homestead-core/utils/logger';
import { useVaccinations } from '../hooks/useVaccinations';
import { useCreateVaccination } from '../hooks/useCreateVaccination';
import { useUpdateVaccination } from '../hooks/useUpdateVaccination';
import { useDeleteVaccination } from '../hooks/useDeleteVaccination';
import { VaccinationForm } from './VaccinationForm';
import { VaccinationCard } from './VaccinationCard';
import { dueSoon, todayIso } from '../utils/due';
import type { Vaccination, VaccinationFormData } from '../types';

type View = 'list' | 'form';

export function HealthHome() {
  const [view, setView] = useState<View>('list');
  const [editingVaccination, setEditingVaccination] = useState<Vaccination | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [vaccinationToDelete, setVaccinationToDelete] = useState<string | null>(null);

  const { data: vaccinations, isLoading, isError, error } = useVaccinations();
  const createMutation = useCreateVaccination();
  const updateMutation = useUpdateVaccination();
  const deleteMutation = useDeleteVaccination();

  const needingAttention = useMemo(
    () => dueSoon(vaccinations ?? [], todayIso()),
    [vaccinations],
  );

  const handleAdd = () => {
    setEditingVaccination(null);
    setView('form');
  };

  const handleEdit = (vaccination: Vaccination) => {
    setEditingVaccination(vaccination);
    setView('form');
  };

  const handleDelete = (id: string) => {
    setVaccinationToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (vaccinationToDelete) {
      await deleteMutation.mutateAsync(vaccinationToDelete);
      setDeleteConfirmOpen(false);
      setVaccinationToDelete(null);
    }
  };

  const handleFormSubmit = async (data: VaccinationFormData) => {
    try {
      if (editingVaccination) {
        await updateMutation.mutateAsync({ id: editingVaccination.id, data });
      } else {
        await createMutation.mutateAsync(data);
      }
      setView('list');
      setEditingVaccination(null);
    } catch (err) {
      logger.error('Failed to save vaccination', err);
    }
  };

  const handleFormCancel = () => {
    setView('list');
    setEditingVaccination(null);
  };

  if (isLoading) {
    return (
      <SkeletonPage body="cards" label="Loading health records" data-testid="health-loading" />
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50/20 border border-red-200 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-900">Failed to load health records</h3>
            <p className="text-sm text-red-700">
              {error instanceof Error ? error.message : 'An error occurred'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {view === 'list' && (
        <>
          <PageHeader
            title="Health"
            subtitle="Your vaccination records. Health records are private — only you can see yours."
            actions={
              <button
                onClick={handleAdd}
                data-testid="add-vaccination-button"
                className="flex items-center gap-2 px-4 py-2 bg-accent-terracotta hover:bg-accent-terracotta-hover text-white rounded-lg font-medium font-body transition-colors shadow-sm"
              >
                <Plus className="w-5 h-5" />
                Add Record
              </button>
            }
          />

          {needingAttention.length > 0 && (
            <div
              data-testid="vaccinations-due-soon"
              className="bg-amber-50 border border-amber-200 rounded-lg p-4"
            >
              <h2 className="font-semibold text-amber-900 mb-2">Due soon</h2>
              <ul className="space-y-1">
                {needingAttention.map((v) => (
                  <li key={v.id} className="text-sm text-amber-800">
                    <span className="font-medium">{v.vaccine}</span>
                    {' — next dose due '}
                    {v.next_due}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(vaccinations?.length ?? 0) === 0 ? (
            <div
              data-testid="vaccinations-empty"
              className="bg-white rounded-lg border border-gray-200 p-10 text-center"
            >
              <ShieldCheck className="w-10 h-10 text-text-muted mx-auto mb-3" aria-hidden="true" />
              <h2 className="font-semibold text-brand-navy mb-1">No vaccination records yet</h2>
              <p className="text-sm text-text-muted">
                Add your first record — snap the vaccine card so you never lose it.
              </p>
            </div>
          ) : (
            <div data-testid="vaccinations-list" className="space-y-3">
              {vaccinations!.map((vaccination) => (
                <VaccinationCard
                  key={vaccination.id}
                  vaccination={vaccination}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </>
      )}

      {view === 'form' && (
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {editingVaccination ? 'Edit Vaccination Record' : 'Add Vaccination Record'}
          </h2>
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <VaccinationForm
              onSubmit={handleFormSubmit}
              onCancel={handleFormCancel}
              initialData={editingVaccination ?? undefined}
              isSubmitting={createMutation.isPending || updateMutation.isPending}
            />
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Vaccination Record"
        message="Are you sure you want to delete this vaccination record? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
