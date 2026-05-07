'use client';

/**
 * Configuration page for the countdown dashboard widget.
 *
 * Lives at `/events/countdown` so the dashboard stays clean — operators
 * pick the target event and toggle which time-unit cells the widget
 * shows. Settings save immediately on change (matches the existing flag
 * UX in `StoreManagement`).
 */

import { useRouter } from 'next/navigation';
import { ArrowLeft, Hourglass, Loader2 } from 'lucide-react';
import { Checkbox } from '@rambleraptor/homestead-core/shared/components/Checkbox';
import { PageHeader } from '@rambleraptor/homestead-core/shared/components/PageHeader';
import { useEvents } from '../hooks/useEvents';
import { useCountdownConfig } from '../hooks/useCountdownConfig';
import { COUNTDOWN_UNITS, type CountdownUnit } from '../utils/countdown';

const UNIT_LABEL: Record<CountdownUnit, string> = {
  months: 'Months',
  weeks: 'Weeks',
  days: 'Days',
  hours: 'Hours',
  minutes: 'Minutes',
  seconds: 'Seconds',
};

export function CountdownConfigPage() {
  const router = useRouter();
  const { data: events = [], isLoading: eventsLoading } = useEvents();
  const config = useCountdownConfig();

  const onEventChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    void config.setEventId(e.target.value);
  };

  const onUnitToggle = (unit: CountdownUnit) => (checked: boolean) => {
    void config.toggleUnit(unit, checked);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <button
        type="button"
        onClick={() => router.push('/events')}
        className="inline-flex items-center gap-1.5 text-sm font-body text-text-muted hover:text-brand-navy transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to events
      </button>

      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Hourglass className="w-7 h-7 text-brand-navy" aria-hidden="true" />
            Countdown widget
          </span>
        }
        subtitle="Choose an event and which time units the dashboard countdown should display."
      />

      <section className="space-y-3 bg-surface-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <label
          htmlFor="countdown-config-event"
          className="block font-body font-medium text-text-main"
        >
          Event
        </label>
        {eventsLoading ? (
          <div className="flex items-center gap-2 text-text-muted text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading events…
          </div>
        ) : (
          <select
            id="countdown-config-event"
            value={config.eventId}
            onChange={onEventChange}
            disabled={config.isLoading}
            data-testid="countdown-config-event-select"
            className="flex h-9 w-full items-center rounded-lg border border-gray-200 bg-surface-white px-3 py-2 text-sm font-body text-text-main shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-terracotta/40 focus:border-accent-terracotta disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">— None —</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
        )}
        {!eventsLoading && events.length === 0 && (
          <p className="text-sm font-body text-text-muted">
            No events yet — add one on the events page first.
          </p>
        )}
      </section>

      <section className="space-y-3 bg-surface-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="font-body font-medium text-text-main">Display units</p>
        <p className="font-body text-sm text-text-muted">
          Each enabled unit becomes a cell on the widget.
        </p>
        <ul className="space-y-2">
          {COUNTDOWN_UNITS.map((unit) => {
            const id = `countdown-config-unit-${unit}`;
            return (
              <li key={unit} className="flex items-center gap-3">
                <Checkbox
                  id={id}
                  checked={config.unitVisibility[unit]}
                  onCheckedChange={onUnitToggle(unit)}
                  data-testid={id}
                />
                <label
                  htmlFor={id}
                  className="font-body text-text-main select-none cursor-pointer"
                >
                  {UNIT_LABEL[unit]}
                </label>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
