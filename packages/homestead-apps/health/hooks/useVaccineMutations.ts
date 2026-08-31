/**
 * Vaccine (series) mutations. The vaccine resource is flat and has no file
 * field, so the generic offline-capable mutation defaults cover it — these
 * wrappers just bind the domain names.
 */

import {
  useResourceCreate,
  useResourceDelete,
  useResourceUpdate,
} from '@rambleraptor/homestead-core/api/resourceHooks';
import type { Vaccine, VaccineFormData } from '../types';

export function useCreateVaccine() {
  return useResourceCreate<Vaccine, VaccineFormData>('health', 'vaccine');
}

/** Variables are `{ id, data }`; send a field as `null` to clear it (merge-patch). */
export function useUpdateVaccine() {
  return useResourceUpdate<Vaccine>('health', 'vaccine');
}

/** Deletes the series and (force-cascade) every dose under it. */
export function useDeleteVaccine() {
  return useResourceDelete('health', 'vaccine');
}
