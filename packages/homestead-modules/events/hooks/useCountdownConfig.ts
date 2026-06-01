/**
 * Read + write the events module's countdown configuration.
 *
 * The config is per-user, stored on the user's `user-preference`
 * record via the user-settings system. Keys (declared in
 * `module.config.ts`):
 *   - `countdown_event_id`         which event to count down to
 *   - `countdown_show_<unit>`       per-unit visibility toggles
 *
 * This hook hides the seven keys behind one ergonomic shape so the
 * widget and the settings widget don't both have to know the field
 * names.
 */

import { useCallback, useMemo } from 'react';
import { useUserSetting } from '@rambleraptor/homestead-core/user-settings';
import { COUNTDOWN_UNITS, type CountdownUnit } from '../utils/countdown';

const MODULE_ID = 'events';

const UNIT_SETTING_KEY: Record<CountdownUnit, string> = {
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
  const eventIdFlag = useUserSetting<string>(MODULE_ID, 'countdown_event_id');
  const months = useUserSetting<boolean>(MODULE_ID, UNIT_SETTING_KEY.months);
  const weeks = useUserSetting<boolean>(MODULE_ID, UNIT_SETTING_KEY.weeks);
  const days = useUserSetting<boolean>(MODULE_ID, UNIT_SETTING_KEY.days);
  const hours = useUserSetting<boolean>(MODULE_ID, UNIT_SETTING_KEY.hours);
  const minutes = useUserSetting<boolean>(MODULE_ID, UNIT_SETTING_KEY.minutes);
  const seconds = useUserSetting<boolean>(MODULE_ID, UNIT_SETTING_KEY.seconds);

  const unitFlags: Record<CountdownUnit, ReturnType<typeof useUserSetting<boolean>>> = {
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
