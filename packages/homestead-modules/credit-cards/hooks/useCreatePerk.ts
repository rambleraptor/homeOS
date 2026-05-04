/**
 * Create Perk Mutation Hook.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { CREDIT_CARDS, CREDIT_CARD_PERKS } from '../resources';
import { logger } from '@rambleraptor/homestead-core/utils/logger';
import type { CreditCardPerk, PerkFormData } from '../types';

export function useCreatePerk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PerkFormData): Promise<CreditCardPerk> => {
      const userId = aepbase.getCurrentUser()?.id;
      const { credit_card, ...body } = data;
      const created = await aepbase.create<CreditCardPerk>(
        CREDIT_CARD_PERKS,
        { ...body, created_by: userId ? `users/${userId}` : undefined },
        { parent: [CREDIT_CARDS, credit_card] },
      );
      return { ...created, credit_card };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.module('credit-cards').all() });
      await queryClient.refetchQueries({ queryKey: queryKeys.module('credit-cards').all() });
      logger.info('Perk created successfully');
    },
    onError: (error) => logger.error('Failed to create perk', error),
  });
}
