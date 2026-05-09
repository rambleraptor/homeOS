'use client';

/**
 * Dashboard widget that counts down to a single configured event.
 *
 * Configuration is intentionally NOT exposed inline on the dashboard —
 * the user manages the chosen event and which time-unit cells to show
 * from the events section of the Settings page, reachable via the gear
 * in the widget header.
 */

import { useEffect, useMemo, useState } from 'react';
import { Hourglass, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { WidgetCard } from '@rambleraptor/homestead-core/shared/components/WidgetCard';
import { useCountdownConfig } from '../hooks/useCountdownConfig';
import { useCountdownEvent } from '../hooks/useCountdownEvent';
import {
  decomposeRemaining,
  tickIntervalMs,
  type CountdownUnit,
} from '../utils/countdown';

const UNIT_LABEL: Record<CountdownUnit, string> = {
  months: 'months',
  weeks: 'weeks',
  days: 'days',
  hours: 'hours',
  minutes: 'min',
  seconds: 'sec',
};

const CONFIG_PATH = '/settings';

export function CountdownWidget() {
  const config = useCountdownConfig();
  const { event, nextDate, isLoading: isLoadingEvent } = useCountdownEvent(
    config.eventId,
  );

  const enabledUnits = config.enabledUnits;
  const interval = useMemo(() => tickIntervalMs(enabledUnits), [enabledUnits]);

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!nextDate || enabledUnits.length === 0) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval, nextDate, enabledUnits.length]);

  const cells = useMemo(() => {
    if (!nextDate) return [];
    return decomposeRemaining(nextDate.getTime() - now, enabledUnits);
  }, [nextDate, now, enabledUnits]);

  let body: React.ReactNode;
  if (config.isLoading || isLoadingEvent) {
    body = (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
      </div>
    );
  } else if (!config.eventId) {
    body = (
      <p className="font-body text-text-muted py-2">
        No countdown configured.
      </p>
    );
  } else if (!event || !nextDate) {
    body = (
      <p className="font-body text-text-muted py-2">
        The configured event no longer exists.
      </p>
    );
  } else if (enabledUnits.length === 0) {
    body = (
      <div className="py-2 space-y-1">
        <p className="font-body text-text-main font-medium">{event.name}</p>
        <p className="font-body text-sm text-text-muted">
          No units selected — the countdown has nothing to display.
        </p>
      </div>
    );
  } else {
    body = (
      <div className="py-2 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-body text-text-main font-medium truncate">
            {event.name}
          </p>
          <p className="font-body text-sm text-text-muted shrink-0">
            {format(nextDate, 'MMM d, yyyy')}
          </p>
        </div>
        <div
          className="flex flex-wrap gap-3"
          data-testid="countdown-cells"
        >
          {cells.map(({ unit, value }) => (
            <div
              key={unit}
              className="flex flex-col items-center min-w-[3.5rem] rounded-lg bg-bg-pearl/60 px-3 py-2"
              data-testid={`countdown-cell-${unit}`}
            >
              <span className="font-display font-semibold text-2xl text-brand-navy tabular-nums">
                {value}
              </span>
              <span className="font-body text-xs text-text-muted uppercase tracking-wide">
                {UNIT_LABEL[unit]}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <WidgetCard
      icon={Hourglass}
      title="Countdown"
      href="/events"
      configHref={CONFIG_PATH}
      configLabel="Configure countdown widget"
      data-testid="countdown-widget"
    >
      {body}
    </WidgetCard>
  );
}
