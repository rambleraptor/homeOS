/**
 * Client-side resolution of a resource **singular** to the plural (URL
 * segment) and definition a reference field points at. The generic form's
 * reference picker uses this to turn `reference: { resource: 'project' }`
 * into a list request against `/projects`.
 *
 * The server already resolves singular → plural (`pluralOf` in
 * `server/chat/tools.ts`); this is the client-side equivalent, built on the
 * app registry's `getAllResourceDefs()` so it sees every declared resource
 * (top-level and nested).
 */

import { getAllResourceDefs } from '@rambleraptor/homestead-core/apps/registry';
import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';

/**
 * The built-in `user` root aepbase provides via EnableUsers. It is not a
 * declared resource (so it never appears in `getAllResourceDefs()`), but
 * `created_by`-style fields reference it, so callers need its plural too.
 */
const USER_SINGULAR = 'user';
const USER_PLURAL = 'users';

/** Find a declared resource definition by its kebab-case singular. */
export function resourceDefBySingular(
  singular: string,
): ResourceDefinition | undefined {
  return getAllResourceDefs().find((def) => def.singular === singular);
}

/**
 * The plural (aepbase collection segment) for a resource singular, or
 * `undefined` when the singular names neither a declared resource nor the
 * built-in `user` root. `user` maps to `users` without a declaration.
 */
export function pluralForSingular(singular: string): string | undefined {
  if (singular === USER_SINGULAR) return USER_PLURAL;
  return resourceDefBySingular(singular)?.plural;
}

/**
 * True when a reference target can be listed by a top-level collection call —
 * i.e. it has no parents. Parent-scoped resources (e.g. `transaction` under a
 * `gift-card`) can't be listed without their parent id, so a plain reference
 * picker can't load their options; callers should fall back to a text input.
 * The built-in `user` root is always top-level.
 */
export function isTopLevelReference(singular: string): boolean {
  if (singular === USER_SINGULAR) return true;
  const def = resourceDefBySingular(singular);
  return Boolean(def) && (def!.parents?.length ?? 0) === 0;
}
