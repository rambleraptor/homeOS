/**
 * People List Component
 *
 * Renders the people list with the shared `<FilterBar>` for client-side
 * filtering. Used by `PeopleHome`.
 */

import { useState } from 'react';
import { Modal } from '@rambleraptor/homestead-core/shared/components/Modal';
import { LoadingBlock } from '@rambleraptor/homestead-core/shared/components/Spinner';
import { ConfirmDialog } from '@rambleraptor/homestead-core/shared/components/ConfirmDialog';
import { useToast } from '@rambleraptor/homestead-core/shared/components/ToastProvider';
import {
  FilterBar,
  AppFiltersProvider,
  useFilteredItems,
} from '@rambleraptor/homestead-core/shared/filters';
import { usePeople } from '../hooks/usePeople';
import { useUpdatePerson } from '../hooks/useUpdatePerson';
import { useDeletePerson } from '../hooks/useDeletePerson';
import { peopleApp } from '../app.config';
import { PersonForm } from './PersonForm';
import { PersonCard } from './PersonCard';
import type { Person, PersonFormData } from '../types';
import { EmptyState } from '@rambleraptor/homestead-core/shared/components/EmptyState';

export function PeopleList() {
  const { data: people, isLoading } = usePeople();

  if (isLoading) {
    return (
      <LoadingBlock size="lg" className="h-64" />
    );
  }

  return (
    <AppFiltersProvider
      appId={peopleApp.id}
      decls={peopleApp.web?.filters ?? []}
      items={people ?? []}
    >
      <PeopleListInner hasAny={(people?.length ?? 0) > 0} />
    </AppFiltersProvider>
  );
}

function PeopleListInner({ hasAny }: { hasAny: boolean }) {
  const filteredPeople = useFilteredItems<Person>();
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const updatePerson = useUpdatePerson();
  const deletePerson = useDeletePerson();
  const toast = useToast();

  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    personId: string | null;
    personName: string | null;
  }>({ isOpen: false, personId: null, personName: null });

  const handleUpdatePerson = async (data: PersonFormData) => {
    if (!editingPerson) {
      return;
    }

    try {
      await updatePerson.mutateAsync({ id: editingPerson.id, data });
      setEditingPerson(null);
      toast.success('Person updated successfully!');
    } catch {
      // Error surfaced by the global mutation error toast (queryClient.ts).
    }
  };

  const handleDeleteClick = (person: Person) => {
    setDeleteConfirmation({
      isOpen: true,
      personId: person.id,
      personName: person.name,
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmation.personId) return;

    try {
      await deletePerson.mutateAsync(deleteConfirmation.personId);
      setDeleteConfirmation({ isOpen: false, personId: null, personName: null });
      toast.success('Person deleted successfully!');
    } catch {
      // Error surfaced by the global mutation error toast (queryClient.ts).
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        All People
      </h2>
      <FilterBar />
      {!hasAny ? (
        <EmptyState
          title="No people yet"
          description="Add your first person to get started."
        />
      ) : filteredPeople.length === 0 ? (
        <EmptyState title="No people match the current filters" />
      ) : (
        <div className="space-y-3">
          {filteredPeople.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              onEdit={setEditingPerson}
              onDelete={handleDeleteClick}
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={!!editingPerson}
        onClose={() => setEditingPerson(null)}
        title="Edit Person"
      >
        {editingPerson && (
          <PersonForm
            initialData={editingPerson}
            onSubmit={handleUpdatePerson}
            onCancel={() => setEditingPerson(null)}
            isSubmitting={updatePerson.isPending}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={deleteConfirmation.isOpen}
        onClose={() =>
          setDeleteConfirmation({ isOpen: false, personId: null, personName: null })
        }
        onConfirm={handleDeleteConfirm}
        title="Delete Person"
        message={`Are you sure you want to delete "${deleteConfirmation.personName}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deletePerson.isPending}
      />
    </div>
  );
}
