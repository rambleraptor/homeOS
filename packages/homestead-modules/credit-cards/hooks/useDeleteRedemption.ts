/**
 * Delete Redemption Mutation Hook.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { CREDIT_CARDS, CREDIT_CARD_PERKS, PERK_REDEMPTIONS } from '../resources';
import { logger } from '@rambleraptor/homestead-core/utils/logger';
import { findRedemptionParents } from './_aepLookup';

export function useDeleteRedemption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { creditCardId, perkId } = findRedemptionParents(queryClient, id);
      await aepbase.remove(PERK_REDEMPTIONS, id, {
        parent: [
          CREDIT_CARDS, creditCardId,
          CREDIT_CARD_PERKS, perkId,
        ],
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.module('credit-cards').all() });
      await queryClient.refetchQueries({ queryKey: queryKeys.module('credit-cards').all() });
      logger.info('Redemption deleted successfully');
    },
    onError: (error) => logger.error('Failed to delete redemption', error),
  });
}
