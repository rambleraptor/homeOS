/**
 * The doc-type registry singleton.
 *
 * Installed once per process, before anything reads the schema: the server does
 * it at boot (`installDocTypesFromDisk`), the SPA in its boot shim (globbing the
 * YAML). Same shape as the app registry — the contract lives here, the two
 * environments differ only in how they find the files.
 *
 * `resources.ts` declares `resources` as a thunk so the schema is built when
 * `getAllResourceDefs()` is called (after boot), not when the module is
 * imported — which would race the install.
 */

import type { DocType } from './docType';

let docTypes: DocType[] | null = null;

/** Install the process-wide doc types. Last call wins; safe to re-run in tests. */
export function initializeDocTypes(types: DocType[]): void {
  docTypes = types;
}

/**
 * The installed doc types, or `[]` when nothing has been installed.
 *
 * Deliberately not an error: an instance with no doc types is legitimate (every
 * upload simply lands `unmatched`), and throwing here would take down the SPA
 * for a config problem better surfaced at boot.
 */
export function getDocTypes(): DocType[] {
  return docTypes ?? [];
}

/** Look up one doc type by its discriminator value. */
export function getDocType(id: string): DocType | undefined {
  return getDocTypes().find((t) => t.id === id);
}

/** Test seam: drop the installed types. */
export function resetDocTypes(): void {
  docTypes = null;
}
