/**
 * Diagnostics: list the registered AEP-136 custom methods (plural, verb,
 * target, http method) so the CLI / UIs can discover them — they don't
 * appear in the engine's OpenAPI since the gateway owns them.
 *
 * Bulk-import methods are synthesized from resources' `bulkImport`
 * declarations rather than declared under `customMethods`, so they're merged in
 * here too — along with each resource's format metadata, which is what lets the
 * standardized import page render an app's format picker with no per-app code.
 */

import {
  allBulkImportCustomMethods,
  bulkImportFormatInfo,
  BULK_IMPORT_VERB,
} from '@rambleraptor/homestead-core/server/bulk-import/method';
import { getAllResourceCustomMethods } from '../app-registry';

export async function customMethodsResponse(): Promise<Response> {
  const declared = getAllResourceCustomMethods();
  const registered = { ...allBulkImportCustomMethods(), ...declared };

  const methods = await Promise.all(
    Object.entries(registered).map(async ([key, def]) => {
      const [plural, verb] = key.split(':', 2);
      // Only bulk-import methods carry format metadata, and resolving it loads
      // the parsers — so don't ask for it on every other verb.
      const formats =
        verb === BULK_IMPORT_VERB ? await bulkImportFormatInfo(plural) : undefined;
      return {
        plural,
        verb,
        target: def.target ?? 'collection',
        method: def.method ?? 'POST',
        async: def.async ?? false,
        ...(formats ? { bulkImport: { formats } } : {}),
      };
    }),
  );
  return Response.json({ methods });
}
