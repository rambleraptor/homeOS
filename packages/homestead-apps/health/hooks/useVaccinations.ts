import { useResourceList } from '@rambleraptor/homestead-core/api/resourceHooks';
import { VACCINATIONS } from '../resources';
import type { Vaccination } from '../types';

/**
 * The current user's vaccination records, newest dose first. The collection
 * is `access: { model: 'private' }`, so the engine already scopes the list
 * to the caller's own rows — no client-side filtering needed.
 */
export function useVaccinations() {
  return useResourceList<Vaccination>('health', 'vaccination', VACCINATIONS, {
    orderBy: '-date_administered',
  });
}
