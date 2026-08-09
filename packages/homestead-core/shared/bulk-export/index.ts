/**
 * Bulk export — client half.
 *
 * Fetching and serializing live on the server, behind the `<plural>:bulk-export`
 * custom method the registry synthesizes from a resource's `bulkExport`
 * declaration. That makes export reachable from the CLI and any REST caller
 * (`GET /api/aep/<plural>:bulk-export`), not just this button.
 *
 * An app's whole export UI is the standardized button:
 *
 * ```tsx
 * <BulkExportButton plural="people" />
 * ```
 *
 * The formats it offers come from the server at runtime, so adding a format to
 * an app changes no UI code. To add one, see
 * `core/resources/bulk-export/types.ts`.
 */

export { BulkExportButton } from './BulkExportButton';
export type { BulkExportButtonProps } from './BulkExportButton';
export { BulkExportContainer } from './BulkExportContainer';
export { defaultLabel } from './types';
export type { BulkExportPageConfig, BulkExportRecord } from './types';
export { useBulkExport, useBulkExportFormats, selectionFilter } from './useBulkExport';
export type { BulkExportInput } from './useBulkExport';
