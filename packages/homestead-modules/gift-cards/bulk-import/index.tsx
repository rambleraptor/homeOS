'use client';

/**
 * Gift Cards Bulk Import Component
 */

import { BulkImportContainer, useBulkImport } from '@rambleraptor/homestead-core/shared/bulk-import';
import { GIFT_CARDS } from '../resources';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { giftCardsImportSchema } from './schema';

export function GiftCardsBulkImport() {
  const bulkImport = useBulkImport({
    collection: GIFT_CARDS,
    queryKey: queryKeys.module('gift-cards').resource('gift-card').list(),
    // Transform data to add null for file fields
    transformData: (data) => ({
      ...(data as Record<string, unknown>),
      front_image: null,
      back_image: null,
    }),
  });

  return (
    <BulkImportContainer
      config={{
        moduleName: 'Gift Cards',
        moduleNamePlural: 'gift cards',
        backRoute: '/gift-cards',
        schema: giftCardsImportSchema,
        onImport: bulkImport.mutateAsync,
        isImporting: bulkImport.isPending,
      }}
    />
  );
}
