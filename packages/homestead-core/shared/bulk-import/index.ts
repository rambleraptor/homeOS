/**
 * Bulk import — client half.
 *
 * Parsing and writing live on the server, behind the `<plural>:bulk-import`
 * custom method the registry synthesizes from a resource's `bulkImport`
 * declaration. That makes bulk import reachable from the CLI
 * (`homestead resources gift-cards bulk-import --@data …`) and any REST caller,
 * not just this page.
 *
 * An app's whole import UI is the standardized page:
 *
 * ```tsx
 * // gift-cards/bulk-import/index.tsx — wired via an `import` route in app.config.ts
 * export function GiftCardBulkImport() {
 *   return (
 *     <BulkImportContainer
 *       config={{
 *         plural: 'gift-cards',
 *         appName: 'Gift Card',
 *         appNamePlural: 'gift cards',
 *         backRoute: '/gift-cards',
 *         preview: GiftCardPreview,
 *       }}
 *     />
 *   );
 * }
 * ```
 *
 * The formats it offers come from the server at runtime, so adding a file type
 * to an app changes no UI code. To add one, see
 * `core/resources/bulk-import/types.ts`.
 */

export { BulkImportContainer } from './BulkImportContainer';
export { DefaultItemPreview } from './DefaultItemPreview';
export {
  useBulkImportFormats,
  useBulkImportPreview,
  useBulkImportRun,
} from './useBulkImport';

export type {
  BulkImportPageConfig,
  ItemPreviewComponent,
  ItemPreviewProps,
  ParsedItem,
} from './types';
