/**
 * The Events page: two tabs over the two kinds of dated thing this app owns.
 *
 * They were one scrolling page — reminders stacked above the events list — which
 * worked while reminders were a handful of hand-typed rows. They aren't any
 * more: apps materialize reminders now (event warnings, bin nights), so the
 * reminder side has its own volume, its own filtering, and its own reason to be
 * looked at. Two tabs keep each one whole instead of making the page a
 * compromise between them.
 *
 * The selected tab lives in the URL (`?tab=reminders`) rather than in state
 * alone, so a reminder notification can deep-link straight to the list it's
 * talking about, and so a reload doesn't bounce you back to Events.
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@rambleraptor/homestead-core/shared/components/Button';
import { Modal } from '@rambleraptor/homestead-core/shared/components/Modal';
import { PageHeader } from '@rambleraptor/homestead-core/shared/components/PageHeader';
import { useToast } from '@rambleraptor/homestead-core/shared/components/ToastProvider';
import { useCreateEvent } from '../hooks/useCreateEvent';
import { EventForm } from './EventForm';
import { EventsList } from './EventsList';
import { RemindersSection } from './RemindersSection';
import type { EventFormData } from '../types';

type EventsTab = 'events' | 'reminders';

const TABS: { id: EventsTab; label: string }[] = [
  { id: 'events', label: 'Events' },
  { id: 'reminders', label: 'Reminders' },
];

/** Query-param name for the selected tab. Also used by `crons/notifyReminders`. */
const TAB_PARAM = 'tab';

export function EventsHome() {
  const createEvent = useCreateEvent();
  const toast = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Anything unrecognized reads as the default tab, so a stale or hand-edited
  // link lands somewhere sensible instead of on a blank page.
  const tab: EventsTab =
    searchParams.get(TAB_PARAM) === 'reminders' ? 'reminders' : 'events';

  const selectTab = (next: EventsTab) => {
    // Mutate a copy so any other params on the URL (filters, and whatever a
    // future surface adds) survive the switch.
    const params = new URLSearchParams(searchParams);
    if (next === 'events') params.delete(TAB_PARAM);
    else params.set(TAB_PARAM, next);
    setSearchParams(params, { replace: true });
  };

  const handleCreate = async (data: EventFormData) => {
    try {
      await createEvent.mutateAsync(data);
      setIsCreateOpen(false);
      toast.success('Event created');
    } catch {
      // Error surfaced by the global mutation error toast (queryClient.ts).
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        subtitle="Yearly-recurring household events"
        actions={
          tab === 'events' ? (
            <Button
              onClick={() => setIsCreateOpen(true)}
              data-testid="add-event-button"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Event
            </Button>
          ) : undefined
        }
      />

      <div
        className="border-b border-gray-200"
        role="tablist"
        data-testid="events-tabs"
      >
        <nav className="-mb-px flex gap-6">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => selectTab(id)}
              data-testid={`events-tab-${id}`}
              className={`border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                tab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'events' ? <EventsList /> : <RemindersSection />}

      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Event"
      >
        <EventForm
          onSubmit={handleCreate}
          onCancel={() => setIsCreateOpen(false)}
          isSubmitting={createEvent.isPending}
        />
      </Modal>
    </div>
  );
}
