import { useResourceList } from '@rambleraptor/homestead-core/api/resourceHooks';
import { CHARITABLE_RECEIPTS } from '../resources';
import type { CharitableReceipt } from '../types';

interface AepCharitableReceipt extends CharitableReceipt {
  path: string;
  create_time: string;
  update_time: string;
}

export function useCharitableReceipts() {
  return useResourceList<AepCharitableReceipt>(
    'receipts',
    'charitable-receipt',
    CHARITABLE_RECEIPTS,
    {
      map: (rec) => ({
        ...rec,
        created: rec.create_time || '',
        updated: rec.update_time || '',
      }),
      sort: (a, b) =>
        (b.donation_date || '').localeCompare(a.donation_date || ''),
    },
  );
}
