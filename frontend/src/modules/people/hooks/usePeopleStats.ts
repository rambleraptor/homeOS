import { useMemo } from 'react';
import { usePeople } from './usePeople';
import type { PeopleStats } from '../types';

export function usePeopleStats() {
  const { data: people, isLoading, isError, error } = usePeople();

  const stats = useMemo<PeopleStats | undefined>(() => {
    if (!people) return undefined;

    const now = new Date();
    const oneMonthFromNow = new Date(now);
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

    const upcomingBirthdays = people.filter((person) => {
      if (!person.birthday) return false;
      const eventDate = new Date(person.birthday);
      let nextOccurrence = new Date(
        now.getFullYear(),
        eventDate.getMonth(),
        eventDate.getDate()
      );
      if (nextOccurrence < now) {
        nextOccurrence = new Date(
          now.getFullYear() + 1,
          eventDate.getMonth(),
          eventDate.getDate()
        );
      }
      return nextOccurrence >= now && nextOccurrence <= oneMonthFromNow;
    });

    const upcomingAnniversaries = people.filter((person) => {
      if (!person.anniversary) return false;
      const eventDate = new Date(person.anniversary);
      let nextOccurrence = new Date(
        now.getFullYear(),
        eventDate.getMonth(),
        eventDate.getDate()
      );
      if (nextOccurrence < now) {
        nextOccurrence = new Date(
          now.getFullYear() + 1,
          eventDate.getMonth(),
          eventDate.getDate()
        );
      }
      return nextOccurrence >= now && nextOccurrence <= oneMonthFromNow;
    });

    return {
      totalPeople: people.length,
      upcomingBirthdays: upcomingBirthdays.length,
      upcomingAnniversaries: upcomingAnniversaries.length,
    };
  }, [people]);

  return {
    data: stats,
    isLoading,
    isError,
    error,
  };
}
