/**
 * Reusable Bulk Import Framework
 *
 * This library provides a generic bulk import system that can be used
 * across different apps to import data from CSV files.
 *
 * Usage:
 * 1. Define your import schema with field validators
 * 2. Create a custom preview component (optional)
 * 3. Use BulkImportContainer with your configuration
 *
 * Example:
 * ```tsx
 * import { BulkImportContainer, useBulkImport } from '@rambleraptor/homestead-core/shared/bulk-import';
 *
 * export function MyAppBulkImport() {
 *   const bulkImport = useBulkImport({
 *     collection: Collections.MY_APP,
 *     queryKey: queryKeys.app('my-app').list(),
 *   });
 *
 *   return (
 *     <BulkImportContainer
 *       config={{
 *         appName: 'My App',
 *         appNamePlural: 'my apps',
 *         backRoute: '/my-app',
 *         schema: myAppSchema,
 *         onImport: bulkImport.mutateAsync,
 *         isImporting: bulkImport.isPending,
 *       }}
 *     />
 *   );
 * }
 * ```
 */

export { BulkImportContainer } from './BulkImportContainer';
export { DefaultItemPreview } from './DefaultItemPreview';
export { parseCSV, downloadCSVTemplate } from './csvParser';
export { useBulkImport } from './useBulkImport';

export type {
  FieldValidator,
  FieldConfig,
  BulkImportSchema,
  ParsedItem,
  CSVParseResult,
  BulkImportResult,
  BulkImportConfig,
} from './types';
