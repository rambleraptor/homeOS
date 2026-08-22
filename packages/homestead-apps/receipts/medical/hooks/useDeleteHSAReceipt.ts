import { useResourceDelete } from '@rambleraptor/homestead-core/api/resourceHooks';

export function useDeleteHSAReceipt() {
  return useResourceDelete('receipts', 'hsa-receipt');
}
