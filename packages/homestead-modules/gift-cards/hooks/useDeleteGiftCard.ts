import { useResourceDelete } from '@rambleraptor/homestead-core/api/resourceHooks';

export function useDeleteGiftCard() {
  return useResourceDelete('gift-cards', 'gift-card');
}
