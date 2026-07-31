/**
 * Hooks for gating access to an app via its built-in `enabled` flag.
 *
 * Semantics for every app:
 *   - 'all'        → every signed-in user
 *   - 'superusers' → only superusers
 *   - 'none'       → nobody (superusers do NOT bypass)
 *   - 'tagged'     → users who belong to a group whose *name* is in the app's
 *                    `enabled_tags` flag (any-of match; §9.2 — group membership
 *                    replaced account-tags as the audience). Superusers do NOT
 *                    bypass — add them to a matching group if needed.
 *
 * Signed-out visitors never pass, regardless of the stored value.
 */

import { useMemo } from 'react';
import { useAuth } from '@rambleraptor/homestead-core/auth/useAuth';
import { useAppFlag } from './useAppFlag';
import { useAppFlags } from './useAppFlags';
import type { User } from '@rambleraptor/homestead-core/auth/types';
import {
  BUILTIN_ENABLED_TAGS_FLAG_KEY,
  DEFAULT_APP_VISIBILITY,
  APP_VISIBILITY_OPTIONS,
  parseTagList,
  type AppVisibility,
} from '../visibility';

function isVisibility(raw: unknown): raw is AppVisibility {
  return (
    typeof raw === 'string' &&
    (APP_VISIBILITY_OPTIONS as readonly string[]).includes(raw)
  );
}

function resolveVisibility(
  visibility: AppVisibility,
  user: User | null,
  enabledTagsRaw: string | undefined,
): boolean {
  if (visibility === 'none') return false;
  if (!user) return false;
  if (visibility === 'all') return true;
  if (visibility === 'superusers') return user.type === 'superuser';
  // 'tagged' — the audience is now group membership (§9.2); the flag holds
  // group names, matched against the caller's groups (hydrated on login).
  const allowed = parseTagList(enabledTagsRaw);
  if (allowed.length === 0) return false;
  const userGroups = user.permissions?.groupNames ?? [];
  return userGroups.some((g) => allowed.includes(g));
}

/**
 * Read a single app's enabled flag and return whether the current
 * viewer can use it.
 */
export function useIsAppEnabled(appId: string): boolean {
  const { user } = useAuth();
  const { value } = useAppFlag<AppVisibility>(appId, 'enabled');
  const { value: enabledTags } = useAppFlag<string>(
    appId,
    BUILTIN_ENABLED_TAGS_FLAG_KEY,
  );
  const visibility: AppVisibility = value ?? DEFAULT_APP_VISIBILITY;
  return resolveVisibility(visibility, user, enabledTags);
}

/**
 * Returns a predicate `(appId) => boolean` backed by a single read of
 * the app-flags singleton. Use this when you need to filter a list of
 * apps — calling `useIsAppEnabled` in a loop would violate the
 * rules of hooks.
 */
export function useAppEnabledPredicate(): (appId: string) => boolean {
  const { user } = useAuth();
  const { values } = useAppFlags();

  return useMemo(() => {
    return (appId: string): boolean => {
      const rawVisibility = values[appId]?.enabled;
      const visibility: AppVisibility = isVisibility(rawVisibility)
        ? rawVisibility
        : DEFAULT_APP_VISIBILITY;
      const rawTags = values[appId]?.[BUILTIN_ENABLED_TAGS_FLAG_KEY];
      const enabledTags = typeof rawTags === 'string' ? rawTags : undefined;
      return resolveVisibility(visibility, user, enabledTags);
    };
  }, [values, user]);
}
