/**
 * People Bulk Import Component
 */

import { BulkImportContainer } from '@rambleraptor/homestead-core/shared/bulk-import';
import { peopleImportSchema } from './schema';
import { useBulkImportPeople } from '../hooks/useBulkImportPeople';

export function PeopleBulkImport() {
  const bulkImport = useBulkImportPeople();

  return (
    <BulkImportContainer
      config={{
        appName: 'People',
        appNamePlural: 'people',
        backRoute: '/people',
        schema: peopleImportSchema,
        onImport: bulkImport.mutateAsync,
        isImporting: bulkImport.isPending,
      }}
    />
  );
}
