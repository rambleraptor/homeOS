/**
 * Resolve a vaccination's `record_image` file field to a blob URL the
 * browser can render. Thin wrapper over the shared `useFileFieldUrl` —
 * doses are URL-nested under their vaccine, so the parent rides along.
 */

import { useFileFieldUrl } from '@rambleraptor/homestead-core/api/resourceHooks';
import { VACCINATIONS, VACCINES } from '../resources';
import type { Vaccination } from '../types';

export function useVaccinationImageUrl(
  vaccineId: string,
  vaccination: Vaccination | null | undefined,
): string | null {
  return useFileFieldUrl(
    VACCINATIONS,
    vaccination?.id,
    'record_image',
    vaccination?.record_image,
    { parent: [VACCINES, vaccineId] },
  );
}
