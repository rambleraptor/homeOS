/**
 * People bulk import — the standardized page.
 *
 * The columns, validation, and the two-pass write (people, then partner links)
 * are declared server-side on the person resource (`bulkImport` in
 * `../resources.ts`, parser and saver in `../methods/bulk-import-csv.ts`).
 */

import { BulkImportContainer } from '@rambleraptor/homestead-core/shared/bulk-import';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { PEOPLE } from '../resources';
import { PersonPreview } from './PersonPreview';

export function PeopleBulkImport() {
  return (
    <BulkImportContainer
      config={{
        plural: PEOPLE,
        appName: 'People',
        appNamePlural: 'people',
        backRoute: '/people',
        queryKey: queryKeys.app('people').all(),
        preview: PersonPreview,
      }}
    />
  );
}
