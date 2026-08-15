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
import { hasEventDate, nextOccurrence } from '../utils/eventDate';
import { useEvents } from '../hooks/useEvents';
import { useUpdateEvent } from '../hooks/useUpdateEvent';
import { useDeleteEvent } from '../hooks/useDeleteEvent';
import { eventsApp } from '../app.config';
import { EventForm } from './EventForm';
import { EventCard } from './EventCard';
import type { Event, EventFormData } from '../types';
import { EmptyState } from '@rambleraptor/homestead-core/shared/components/EmptyState';

function eventNextOccurrenceMs(e: Event): number {
  if (!hasEventDate(e)) return Number.POSITIVE_INFINITY;
  return nextOccurrence(e).getTime();
}

export function EventsList() {
  const { data: events, isLoading } = useEvents();

  if (isLoading) {
    return (
      <LoadingBlock size="lg" className="h-64" />
    );
  }

  return (
    <AppFiltersProvider
      appId={eventsApp.id}
      decls={eventsApp.web?.filters ?? []}
      items={events ?? []}
    >
      <EventsListInner hasAny={(events?.length ?? 0) > 0} />
    </AppFiltersProvider>
  );
}

function EventsListInner({ hasAny }: { hasAny: boolean }) {
  const filteredEvents = useFilteredItems<Event>();
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; name: string } | null>(
    null,
  );
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();
  const toast = useToast();

  const sorted = [...filteredEvents].sort(
    (a, b) => eventNextOccurrenceMs(a) - eventNextOccurrenceMs(b),
  );

  const handleUpdate = async (data: EventFormData) => {
    if (!editingEvent) return;
    try {
      await updateEvent.mutateAsync({ id: editingEvent.id, data });
      setEditingEvent(null);
      toast.success('Event updated');
    } catch {
      // Error surfaced by the global mutation error toast (queryClient.ts).
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirm) return;
    try {
      await deleteEvent.mutateAsync(confirm.id);
      setConfirm(null);
      toast.success('Event deleted');
    } catch {
      // Error surfaced by the global mutation error toast (queryClient.ts).
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">All Events</h2>
      <FilterBar />
      {!hasAny ? (
        <EmptyState
          title="No events yet"
          description="Add your first event to get started."
        />
      ) : sorted.length === 0 ? (
        <EmptyState title="No events match the current filters" />
      ) : (
        <div className="space-y-3">
          {sorted.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onEdit={setEditingEvent}
              onDelete={(e) => setConfirm({ id: e.id, name: e.name })}
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={!!editingEvent}
        onClose={() => setEditingEvent(null)}
        title="Edit Event"
      >
        {editingEvent && (
          <EventForm
            initialData={editingEvent}
            onSubmit={handleUpdate}
            onCancel={() => setEditingEvent(null)}
            isSubmitting={updateEvent.isPending}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Event"
        message={
          confirm
            ? `Are you sure you want to delete "${confirm.name}"? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteEvent.isPending}
      />
    </div>
  );
}
