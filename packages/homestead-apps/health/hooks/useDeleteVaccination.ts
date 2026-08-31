import { useResourceDelete } from '@rambleraptor/homestead-core/api/resourceHooks';

export function useDeleteVaccination() {
  return useResourceDelete('health', 'vaccination');
}
