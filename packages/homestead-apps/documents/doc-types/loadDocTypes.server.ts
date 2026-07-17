/**
 * Server-side doc-type discovery: read the package's built-in YAML types, then
 * the operator's `documents/types/*.yaml`, and merge (project wins by id).
 *
 * The SPA does the equivalent at build time via `import.meta.glob` in its boot
 * shim; both sides share `parseDocType`/`mergeDocTypes` in `./docType`.
 *
 * Server-only (node:fs) — never import from browser code.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { mergeDocTypes, parseDocType, type DocType } from './docType';
import { initializeDocTypes } from './registry';

/** The built-in types shipped alongside this module. */
export function builtinDocTypesDir(): string {
  return fileURLToPath(new URL('.', import.meta.url));
}

/**
 * The project's doc-type directory: `HOMESTEAD_DOC_TYPES_DIR` when the launcher
 * (or a test) sets it, else `<cwd>/documents/types` — the server always runs
 * with cwd = project root, same convention as `defaultAppsDir()`.
 */
export function defaultDocTypesDir(): string {
  return (
    process.env.HOMESTEAD_DOC_TYPES_DIR ?? join(process.cwd(), 'documents', 'types')
  );
}

/**
 * Parse every `*.yaml` in a directory, sorted by filename for deterministic
 * order. A missing directory yields nothing; a malformed file throws, since a
 * doc type that silently fails to load is indistinguishable from one the model
 * never matches.
 */
export function readDocTypesDir(dir: string): DocType[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .sort()
    .map((file) => parseDocType(readFileSync(join(dir, file), 'utf8'), file));
}

/** Built-in types merged with the project's overrides. */
export function loadDocTypesFromDisk(projectDir = defaultDocTypesDir()): DocType[] {
  return mergeDocTypes(
    readDocTypesDir(builtinDocTypesDir()),
    readDocTypesDir(projectDir),
  );
}

/** Read from disk and install. Called once at server boot, before schema sync. */
export function installDocTypesFromDisk(projectDir = defaultDocTypesDir()): DocType[] {
  const types = loadDocTypesFromDisk(projectDir);
  initializeDocTypes(types);
  return types;
}
