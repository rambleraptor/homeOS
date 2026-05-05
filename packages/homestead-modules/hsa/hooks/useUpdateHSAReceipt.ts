import { useResourceUpdate } from '@rambleraptor/homestead-core/api/resourceHooks';
import type { HSAReceipt } from '../types';

export function useUpdateHSAReceipt() {
  return useResourceUpdate<HSAReceipt, Partial<HSAReceipt>>('hsa', 'receipt');
}
