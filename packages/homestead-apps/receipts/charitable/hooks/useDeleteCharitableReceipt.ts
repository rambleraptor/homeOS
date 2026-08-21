import { useResourceDelete } from '@rambleraptor/homestead-core/api/resourceHooks';

export function useDeleteCharitableReceipt() {
  return useResourceDelete('receipts', 'charitable-receipt');
}
