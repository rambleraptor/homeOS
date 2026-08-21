import { useResourceUpdate } from '@rambleraptor/homestead-core/api/resourceHooks';
import type { CharitableReceipt } from '../types';

export function useUpdateCharitableReceipt() {
  return useResourceUpdate<CharitableReceipt, Partial<CharitableReceipt>>(
    'receipts',
    'charitable-receipt',
  );
}
