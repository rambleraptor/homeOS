import { useQuery } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { HSA_RECEIPTS } from '../resources';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import type { HSAReceipt } from '../types';

interface AepHSAReceipt extends HSAReceipt {
  path: string;
  create_time: string;
  update_time: string;
}

export function useHSAReceipts() {
  return useQuery({
    queryKey: queryKeys.module('hsa').resource('hsa-receipt').list(),
    queryFn: async () => {
      const receipts = await aepbase.list<AepHSAReceipt>(HSA_RECEIPTS);
      return receipts
        .map((rec) => ({
          ...rec,
          created: rec.create_time || '',
          updated: rec.update_time || '',
        }))
        .sort((a, b) =>
          (b.service_date || '').localeCompare(a.service_date || ''),
        );
    },
  });
}
