'use client';

/**
 * Read + write the events module's countdown configuration.
 *
 * The config is a household singleton stored as module flags on the
 * events module:
 *   - `countdown_event_id`         which event to count down to
 *   - `countdown_show_<unit>`       per-unit visibility toggles
 *
 * This hook hides the seven flag keys behind one ergonomic shape so the
 * widget and the config page don't both have to know the field names.
 */

import { useCallback, useMemo } from 'react';
import { useModuleFlag } from '@rambleraptor/homestead-core/settings';
import { COUNTDOWN_UNITS, type CountdownUnit } from '../utils/countdown';

const MODULE_ID = 'events';

const UNIT_FLAG_KEY: Record<CountdownUnit, string> = {
  months: 'countdown_show_months',
  weeks: 'countdown_show_weeks',
  days: 'countdown_show_days',
  hours: 'countdown_show_hours',
  minutes: 'countdown_show_minutes',
  seconds: 'countdown_show_seconds',
};

export interface UseCountdownConfigResult {
  eventId: string;
  enabledUnits: CountdownUnit[];
  unitVisibility: Record<CountdownUnit, boolean>;
  isLoading: boolean;
  setEventId: (id: string) => Promise<void>;
  toggleUnit: (unit: CountdownUnit, on: boolean) => Promise<void>;
}

export function useCountdownConfig(): UseCountdownConfigResult {
  const eventIdFlag = useModuleFlag<string>(MODULE_ID, 'countdown_event_id');
  const months = useModuleFlag<boolean>(MODULE_ID, UNIT_FLAG_KEY.months);
  const weeks = useModuleFlag<boolean>(MODULE_ID, UNIT_FLAG_KEY.weeks);
  const days = useModuleFlag<boolean>(MODULE_ID, UNIT_FLAG_KEY.days);
  const hours = useModuleFlag<boolean>(MODULE_ID, UNIT_FLAG_KEY.hours);
  const minutes = useModuleFlag<boolean>(MODULE_ID, UNIT_FLAG_KEY.minutes);
  const seconds = useModuleFlag<boolean>(MODULE_ID, UNIT_FLAG_KEY.seconds);

  const unitFlags: Record<CountdownUnit, ReturnType<typeof useModuleFlag<boolean>>> = {
    months,
    weeks,
    days,
    hours,
    minutes,
    seconds,
  };

  const unitVisibility = useMemo<Record<CountdownUnit, boolean>>(
    () => ({
      months: months.value ?? false,
      weeks: weeks.value ?? false,
      days: days.value ?? false,
      hours: hours.value ?? false,
      minutes: minutes.value ?? false,
      seconds: seconds.value ?? false,
    }),
    [months.value, weeks.value, days.value, hours.value, minutes.value, seconds.value],
  );

  const enabledUnits = useMemo(
    () => COUNTDOWN_UNITS.filter((u) => unitVisibility[u]),
    [unitVisibility],
  );

  const setEventId = useCallback(
    async (id: string) => {
      await eventIdFlag.setValue(id);
    },
    [eventIdFlag],
  );

  const toggleUnit = useCallback(
    async (unit: CountdownUnit, on: boolean) => {
      await unitFlags[unit].setValue(on);
    },
    [unitFlags],
  );

  const isLoading =
    eventIdFlag.isLoading ||
    months.isLoading ||
    weeks.isLoading ||
    days.isLoading ||
    hours.isLoading ||
    minutes.isLoading ||
    seconds.isLoading;

  return {
    eventId: eventIdFlag.value ?? '',
    enabledUnits,
    unitVisibility,
    isLoading,
    setEventId,
    toggleUnit,
  };
}
