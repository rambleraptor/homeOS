import { useQuery } from '@tanstack/react-query';
import { getCollection, Collections } from '@/core/api/pocketbase';
import { queryKeys } from '@/core/api/queryClient';
import type { Person } from '@/modules/people/types';

/**
 * Hook to fetch upcoming birthdays and anniversaries (next 30 days)
 *
 * TODO: This is not optimal. It fetches all people and filters them on the client.
 * A better approach would be to have a dedicated API endpoint or a more complex query.
 */
export function useUpcomingPeople() {
  return useQuery({
    queryKey: queryKeys.module('dashboard').list({ type: 'people-upcoming' }),
    queryFn: async () => {
      const people = await getCollection<Person>(Collections.PEOPLE).getFullList({
        sort: 'name',
      });

      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);

      const upcoming = people.map(person => {
        const upcomingEvents = [];
        if (person.birthday) {
            const birthday = new Date(person.birthday);
            const nextBirthday = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
            if (nextBirthday < today) {
                nextBirthday.setFullYear(today.getFullYear() + 1);
            }
            if (nextBirthday >= today && nextBirthday <= thirtyDaysFromNow) {
                upcomingEvents.push({
                    person,
                    type: 'Birthday',
                    date: nextBirthday,
                });
            }
        }
        if (person.anniversary) {
            const anniversary = new Date(person.anniversary);
            const nextAnniversary = new Date(today.getFullYear(), anniversary.getMonth(), anniversary.getDate());
            if (nextAnniversary < today) {
                nextAnniversary.setFullYear(today.getFullYear() + 1);
            }
            if (nextAnniversary >= today && nextAnniversary <= thirtyDaysFromNow) {
                upcomingEvents.push({
                    person,
                    type: 'Anniversary',
                    date: nextAnniversary,
                });
            }
        }
        return upcomingEvents;
      }).flat();
      
      return upcoming.sort((a, b) => a.date.getTime() - b.date.getTime());
    },
  });
}
