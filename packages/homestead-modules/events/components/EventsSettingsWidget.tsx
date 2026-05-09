'use client';

/**
 * Per-user countdown configuration shown on the Settings page.
 *
 * Picks the target event and toggles which time-unit cells the
 * dashboard countdown widget displays. Settings save immediately on
 * change. Adapted from the previous `/events/countdown` page;
 * configuration is now per-user (stored on the `user-preference`
 * record via the user-settings system) rather than household-wide.
 */

import { Loader2 } from 'lucide-react';
import { Checkbox } from '@rambleraptor/homestead-core/shared/components/Checkbox';
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

export function EventsSettingsWidget() {
  const { data: events = [], isLoading: eventsLoading } = useEvents();
  const config = useCountdownConfig();

  const onEventChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    void config.setEventId(e.target.value);
  };

  const onUnitToggle = (unit: CountdownUnit) => (checked: boolean) => {
    void config.toggleUnit(unit, checked);
  };

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="countdown-config-event"
          className="block text-sm font-medium text-gray-900 mb-2"
        >
          Countdown event
        </label>
        {eventsLoading ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
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
            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
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
          <p className="mt-1 text-xs text-gray-500">
            No events yet — add one on the events page first.
          </p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          The dashboard countdown widget points at this event. Empty
          shows a configure prompt.
        </p>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-900 mb-2">
          Display units
        </p>
        <p className="text-xs text-gray-500 mb-3">
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
                  className="text-sm text-gray-900 select-none cursor-pointer"
                >
                  {UNIT_LABEL[unit]}
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
