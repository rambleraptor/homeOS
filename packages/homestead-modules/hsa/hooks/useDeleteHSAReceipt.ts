import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { HSA_RECEIPTS } from '../resources';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { logger } from '@rambleraptor/homestead-core/utils/logger';

export function useDeleteHSAReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await aepbase.remove(HSA_RECEIPTS, id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.module('hsa').all() });
      await queryClient.refetchQueries({ queryKey: queryKeys.module('hsa').all() });
      logger.info('HSA receipt deleted successfully');
    },
    onError: (error) => logger.error('Failed to delete HSA receipt', error),
  });
}
