/**
 * The curb calendar: the next couple of weeks of collection days, one row per
 * day, with the streams going out that day and any holiday delay called out.
 *
 * Read-only. Rows are written by an external hauler sync (see the
 * `garbage-pickup` resource's `source` field), so there's no add/edit affordance
 * here — the empty state explains where records come from instead.
 */

import { AlertCircle, Trash2 } from 'lucide-react';
import { Badge } from '@rambleraptor/homestead-core/shared/components/Badge';
import { SkeletonList } from '@rambleraptor/homestead-core/shared/components/Skeleton';
import { useUpcomingPickupDays } from '../hooks/useGarbagePickups';
import { parseIsoDate, relativeDayLabel } from '../utils/pickups';
import { StreamChip } from './StreamChip';

const LOOKAHEAD_DAYS = 14;

export function UpcomingPickups() {
  const { data: days, isLoading, isError, error } = useUpcomingPickupDays(LOOKAHEAD_DAYS);

  return (
    <section data-testid="home-pickups">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Trash &amp; recycling
      </h2>

      {isLoading && (
        <SkeletonList
          rows={3}
          label="Loading pickups"
          data-testid="home-pickups-loading"
        />
      )}

      {isError && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error instanceof Error ? error.message : 'Failed to load pickups'}
        </div>
      )}

      {days && days.length === 0 && (
        <p
          className="rounded-2xl border border-gray-100 bg-surface-white px-4 py-8 text-center text-sm text-gray-500"
          data-testid="home-pickups-empty"
        >
          No pickups scheduled in the next {LOOKAHEAD_DAYS} days. Schedules are
          filled in by the pickup sync — if this stays empty, check that it ran.
        </p>
      )}

      {days && days.length > 0 && (
        <ul
          className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 bg-surface-white"
          data-testid="home-pickups-list"
        >
          {days.map((day) => {
            const date = parseIsoDate(day.date);
            const note = day.pickups.find((pickup) => pickup.note)?.note;

            return (
              <li
                key={day.date}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                data-testid={`home-pickup-day-${day.date}`}
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-body font-medium text-text-main">
                    {relativeDayLabel(day.date) ?? day.date}
                    {day.delayed && <Badge variant="warning">Delayed</Badge>}
                  </p>
                  <p className="font-body text-sm text-text-muted">
                    {date
                      ? date.toLocaleDateString(undefined, {
                          month: 'long',
                          day: 'numeric',
                        })
                      : day.date}
                    {note ? ` · ${note}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {day.pickups.map((pickup) => (
                    <StreamChip key={pickup.id} stream={pickup.stream} />
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {days && days.length > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
          <Trash2 className="h-3 w-3" aria-hidden="true" />
          Next {LOOKAHEAD_DAYS} days
        </p>
      )}
    </section>
  );
}
