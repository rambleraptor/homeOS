/**
 * People List Component
 *
 * Renders the people list with the shared `<FilterBar>` for client-side
 * filtering. Used by `PeopleHome`.
 */

import { useState } from 'react';
import { Card } from '@rambleraptor/homestead-core/shared/components/Card';
import { Modal } from '@rambleraptor/homestead-core/shared/components/Modal';
import { Spinner } from '@rambleraptor/homestead-core/shared/components/Spinner';
import { Button } from '@rambleraptor/homestead-core/shared/components/Button';
import { Checkbox } from '@rambleraptor/homestead-core/shared/components/Checkbox';
import { ConfirmDialog } from '@rambleraptor/homestead-core/shared/components/ConfirmDialog';
import { useToast } from '@rambleraptor/homestead-core/shared/components/ToastProvider';
import { useRowSelection } from '@rambleraptor/homestead-core/shared/hooks/useRowSelection';
import { BulkExportButton, selectionFilter } from '@rambleraptor/homestead-core/shared/bulk-export';
import {
  FilterBar,
  AppFiltersProvider,
  useFilteredItems,
} from '@rambleraptor/homestead-core/shared/filters';
import { usePeople } from '../hooks/usePeople';
import { useUpdatePerson } from '../hooks/useUpdatePerson';
import { useDeletePerson } from '../hooks/useDeletePerson';
import { peopleApp } from '../app.config';
import { PEOPLE } from '../resources';
import { PersonForm } from './PersonForm';
import { PersonCard } from './PersonCard';
import type { Person, PersonFormData } from '../types';

export function PeopleList() {
  const { data: people, isLoading } = usePeople();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
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
  const selection = useRowSelection(filteredPeople.map((p) => p.id));
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
        <Card>
          <p className="text-center text-gray-600 py-8">
            No people yet. Add your first person to get started!
          </p>
        </Card>
      ) : filteredPeople.length === 0 ? (
        <Card>
          <p className="text-center text-gray-600 py-8">
            No people match the current filters
          </p>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-3 min-h-9">
            <Checkbox
              checked={
                selection.allVisibleSelected
                  ? true
                  : selection.someVisibleSelected
                    ? 'indeterminate'
                    : false
              }
              onCheckedChange={selection.toggleAllVisible}
              aria-label="Select all people"
              data-testid="select-all-people"
            />
            {selection.count > 0 ? (
              <>
                <span className="text-sm text-gray-600" data-testid="selection-count">
                  {selection.count} selected
                </span>
                <BulkExportButton
                  plural={PEOPLE}
                  filter={selectionFilter(selection.selectedIds)}
                  disabled={selection.count === 0}
                  label="Export selected"
                />
                <Button variant="secondary" size="sm" onClick={selection.clear}>
                  Clear
                </Button>
              </>
            ) : (
              <span className="text-sm text-gray-500">Select all</span>
            )}
          </div>
          <div className="space-y-3">
            {filteredPeople.map((person) => (
              <PersonCard
                key={person.id}
                person={person}
                onEdit={setEditingPerson}
                onDelete={handleDeleteClick}
                selection={{
                  selected: selection.isSelected(person.id),
                  onChange: (on) => selection.set(person.id, on),
                }}
              />
            ))}
          </div>
        </>
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
