import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { HSA_RECEIPTS } from '../resources';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { logger } from '@rambleraptor/homestead-core/utils/logger';
import type { HSAReceipt } from '../types';

interface UpdateHSAReceiptParams {
  id: string;
  data: Partial<HSAReceipt>;
}

export function useUpdateHSAReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: UpdateHSAReceiptParams) =>
      aepbase.update<HSAReceipt>(HSA_RECEIPTS, id, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.module('hsa').all() });
      await queryClient.refetchQueries({ queryKey: queryKeys.module('hsa').all() });
      logger.info('HSA receipt updated successfully');
    },
    onError: (error) => logger.error('Failed to update HSA receipt', error),
  });
}
