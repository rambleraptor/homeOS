/// <reference types="vite/client" />
/**
 * Client-side doc-type discovery: the package's built-in YAML plus the
 * operator's `documents/types/*.yaml`, merged (project wins by id), installed
 * into the registry. The build-time mirror of `loadDocTypes.server.ts` (fs).
 *
 * Vite-only — `import.meta.glob` is a build transform. It's safe for the app
 * config to import this module statically: the glob runs only inside
 * {@link installDocTypesFromModules} (the app's `boot.client`), which the server
 * never calls, so nothing Vite-specific evaluates there.
 *
 * `@homestead-project` resolves to the operator's project root via a Vite alias
 * (see homestead-app/vite.config.ts); a project without the directory globs to
 * zero modules.
 */

import { mergeDocTypes, parseDocType, type DocType } from './docType';
import { initializeDocTypes } from './registry';

/** YAML loaded as raw text (the bundler has no notion of YAML) and parsed. */
function parseRawModules(modules: Record<string, unknown>): DocType[] {
  return Object.keys(modules)
    .sort()
    .map((path) => parseDocType(modules[path] as string, path));
}

/** Load built-in + project doc types and install them into the registry. */
export function installDocTypesFromModules(): DocType[] {
  const builtins = import.meta.glob('./*.yaml', {
    query: '?raw',
    import: 'default',
    eager: true,
  });
  const overrides = import.meta.glob('@homestead-project/documents/types/*.yaml', {
    query: '?raw',
    import: 'default',
    eager: true,
  });

  const types = mergeDocTypes(parseRawModules(builtins), parseRawModules(overrides));
  initializeDocTypes(types);
  return types;
}
