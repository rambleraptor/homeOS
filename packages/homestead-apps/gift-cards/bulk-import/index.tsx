/**
 * Gift cards bulk import — the standardized page.
 *
 * The CSV columns, their validation, and the writes are all declared
 * server-side on the gift-card resource (`bulkImport` in `../resources.ts`,
 * parser in `../methods/bulk-import-csv.ts`). All that's left here is how a
 * parsed row looks.
 */

import { BulkImportContainer } from '@rambleraptor/homestead-core/shared/bulk-import';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { GIFT_CARDS } from '../resources';
import { GiftCardPreview } from './GiftCardPreview';

export function GiftCardsBulkImport() {
  return (
    <BulkImportContainer
      config={{
        plural: GIFT_CARDS,
        appName: 'Gift Cards',
        appNamePlural: 'gift cards',
        backRoute: '/gift-cards',
        queryKey: queryKeys.app('gift-cards').all(),
        preview: GiftCardPreview,
      }}
    />
  );
}
