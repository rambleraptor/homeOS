/**
 * Diagnostics: list the registered AEP-136 custom methods (plural, verb,
 * target, http method) so the CLI / UIs can discover them — they don't
 * appear in the engine's OpenAPI since the gateway owns them.
 */

import { getAllResourceCustomMethods } from '../app-registry';

export function customMethodsResponse(): Response {
  const methods = Object.entries(getAllResourceCustomMethods()).map(([key, def]) => {
    const [plural, verb] = key.split(':', 2);
    return {
      plural,
      verb,
      target: def.target ?? 'collection',
      method: def.method ?? 'POST',
    };
  });
  return Response.json({ methods });
}
