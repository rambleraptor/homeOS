/**
 * People Bulk Import Component
 */

import { BulkImportContainer, useBulkImport } from '@/shared/bulk-import';
import { Collections } from '@/core/api/pocketbase';
import { queryKeys } from '@/core/api/queryClient';
import { peopleImportSchema } from './schema';

export function PeopleBulkImport() {
  const bulkImport = useBulkImport({
    collection: Collections.PEOPLE,
    queryKey: queryKeys.module('people').list(),
  });

  return (
    <BulkImportContainer
      config={{
        moduleName: 'People',
        moduleNamePlural: 'people',
        backRoute: '/people',
        schema: peopleImportSchema,
        onImport: bulkImport.mutateAsync,
        isImporting: bulkImport.isPending,
      }}
    />
  );
}
