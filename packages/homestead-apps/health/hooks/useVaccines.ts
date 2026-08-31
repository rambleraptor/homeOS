import { useResourceList } from '@rambleraptor/homestead-core/api/resourceHooks';
import { VACCINES } from '../resources';
import type { Vaccine } from '../types';

/**
 * The current user's vaccine series, alphabetical. The collection is
 * `access: { model: 'private' }`, so the engine already scopes the list to
 * the caller's own rows — no client-side filtering needed.
 */
export function useVaccines() {
  return useResourceList<Vaccine>('health', 'vaccine', VACCINES, {
    orderBy: 'name',
  });
}
