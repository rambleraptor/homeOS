/**
 * Hooks for gating access to a module via its built-in `enabled` flag.
 *
 * Semantics for every module:
 *   - 'all'        → every signed-in user
 *   - 'superusers' → only superusers
 *   - 'none'       → nobody (superusers do NOT bypass)
 *   - 'tagged'     → users whose account `tags` intersects the module's
 *                    `enabled_tags` flag (any-of match). Superusers do
 *                    NOT bypass — give them a matching tag if needed.
 *
 * Signed-out visitors never pass, regardless of the stored value.
 */

import { useMemo } from 'react';
import { useAuth } from '@rambleraptor/homestead-core/auth/useAuth';
import { useModuleFlag } from './useModuleFlag';
import { useModuleFlags } from './useModuleFlags';
import type { User } from '@rambleraptor/homestead-core/auth/types';
import {
  BUILTIN_ENABLED_TAGS_FLAG_KEY,
  DEFAULT_MODULE_VISIBILITY,
  MODULE_VISIBILITY_OPTIONS,
  parseTagList,
  type ModuleVisibility,
} from '../visibility';

function isVisibility(raw: unknown): raw is ModuleVisibility {
  return (
    typeof raw === 'string' &&
    (MODULE_VISIBILITY_OPTIONS as readonly string[]).includes(raw)
  );
}

function resolveVisibility(
  visibility: ModuleVisibility,
  user: User | null,
  enabledTagsRaw: string | undefined,
): boolean {
  if (visibility === 'none') return false;
  if (!user) return false;
  if (visibility === 'all') return true;
  if (visibility === 'superusers') return user.type === 'superuser';
  // 'tagged'
  const allowed = parseTagList(enabledTagsRaw);
  if (allowed.length === 0) return false;
  const userTags = user.tags ?? [];
  return userTags.some((t) => allowed.includes(t));
}

/**
 * Read a single module's enabled flag and return whether the current
 * viewer can use it.
 */
export function useIsModuleEnabled(moduleId: string): boolean {
  const { user } = useAuth();
  const { value } = useModuleFlag<ModuleVisibility>(moduleId, 'enabled');
  const { value: enabledTags } = useModuleFlag<string>(
    moduleId,
    BUILTIN_ENABLED_TAGS_FLAG_KEY,
  );
  const visibility: ModuleVisibility = value ?? DEFAULT_MODULE_VISIBILITY;
  return resolveVisibility(visibility, user, enabledTags);
}

/**
 * Returns a predicate `(moduleId) => boolean` backed by a single read of
 * the module-flags singleton. Use this when you need to filter a list of
 * modules — calling `useIsModuleEnabled` in a loop would violate the
 * rules of hooks.
 */
export function useModuleEnabledPredicate(): (moduleId: string) => boolean {
  const { user } = useAuth();
  const { values } = useModuleFlags();

  return useMemo(() => {
    return (moduleId: string): boolean => {
      const rawVisibility = values[moduleId]?.enabled;
      const visibility: ModuleVisibility = isVisibility(rawVisibility)
        ? rawVisibility
        : DEFAULT_MODULE_VISIBILITY;
      const rawTags = values[moduleId]?.[BUILTIN_ENABLED_TAGS_FLAG_KEY];
      const enabledTags = typeof rawTags === 'string' ? rawTags : undefined;
      return resolveVisibility(visibility, user, enabledTags);
    };
  }, [values, user]);
}
