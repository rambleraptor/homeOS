/**
 * Delete Perk Mutation Hook.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { CREDIT_CARDS, CREDIT_CARD_PERKS } from '../resources';
import { logger } from '@rambleraptor/homestead-core/utils/logger';
import { findPerkParentCardId } from './_aepLookup';

export function useDeletePerk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const cardId = findPerkParentCardId(queryClient, id);
      await aepbase.remove(CREDIT_CARD_PERKS, id, {
        parent: [CREDIT_CARDS, cardId],
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.module('credit-cards').all() });
      await queryClient.refetchQueries({ queryKey: queryKeys.module('credit-cards').all() });
      logger.info('Perk deleted successfully');
    },
    onError: (error) => logger.error('Failed to delete perk', error),
  });
}
