import { useResourceList } from '@rambleraptor/homestead-core/api/resourceHooks';
import { HSA_RECEIPTS } from '../resources';
import type { HSAReceipt } from '../types';

interface AepHSAReceipt extends HSAReceipt {
  path: string;
  create_time: string;
  update_time: string;
}

export function useHSAReceipts() {
  return useResourceList<AepHSAReceipt>('receipts', 'hsa-receipt', HSA_RECEIPTS, {
    map: (rec) => ({
      ...rec,
      created: rec.create_time || '',
      updated: rec.update_time || '',
    }),
    sort: (a, b) =>
      (b.service_date || '').localeCompare(a.service_date || ''),
  });
}
