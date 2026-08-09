/**
 * People bulk export — the standardized screen.
 *
 * A dedicated page for picking which people to export; the join that flattens a
 * person with their address and partner is declared server-side on the person
 * resource (`bulkExport` in `../resources.ts`, serializer + source in
 * `../methods/bulk-export-csv.ts`). The screen only needs a label per row, which
 * defaults to the person's `name`.
 */

import { BulkExportContainer } from '@rambleraptor/homestead-core/shared/bulk-export';
import { PEOPLE } from '../resources';

export function PeopleBulkExport() {
  return (
    <BulkExportContainer
      config={{
        plural: PEOPLE,
        appName: 'People',
        appNamePlural: 'people',
        backRoute: '/people',
      }}
    />
  );
}
