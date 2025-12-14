import { useMemo } from 'react';
import { useEvents } from './useEvents';
import type { EventStats } from '../types';

export function useEventStats() {
  const { data: events, isLoading, isError, error } = useEvents();

  const stats = useMemo<EventStats | undefined>(() => {
    if (!events) return undefined;

    const now = new Date();
    const oneMonthFromNow = new Date(now);
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

    const upcomingEvents = events.filter((event) => {
      const eventDate = new Date(event.event_date);

      // For recurring yearly events, check if it's upcoming this year or next year
      if (event.recurring_yearly) {
        let nextOccurrence = new Date(
          now.getFullYear(),
          eventDate.getMonth(),
          eventDate.getDate()
        );

        // If the event has already passed this year, use next year's date
        if (nextOccurrence < now) {
          nextOccurrence = new Date(
            now.getFullYear() + 1,
            eventDate.getMonth(),
            eventDate.getDate()
          );
        }

        return nextOccurrence >= now && nextOccurrence <= oneMonthFromNow;
      }

      return eventDate >= now && eventDate <= oneMonthFromNow;
    });

    return {
      totalEvents: events.length,
      upcomingBirthdays: upcomingEvents.filter(
        (e) => e.event_type === 'birthday'
      ).length,
      upcomingAnniversaries: upcomingEvents.filter(
        (e) => e.event_type === 'anniversary'
      ).length,
    };
  }, [events]);

  return {
    data: stats,
    isLoading,
    isError,
    error,
  };
}
