/**
 * `useCan()` — the centralized client capability check (design §10). Returns a
 * memoized `can(verb, resourceType, opts?)` predicate so lists can be filtered
 * without calling a hook per item (mirrors `useAppEnabledPredicate`).
 */

import { useMemo } from 'react';
import { useAuth } from '../auth/useAuth';
import { canWith, type CanOptions } from './client';
import type { Verb } from './resolve';

export type CanFn = (verb: Verb, resourceType: string, opts?: CanOptions) => boolean;

export function useCan(): CanFn {
  const { user } = useAuth();
  return useMemo<CanFn>(() => {
    if (!user) return () => false;
    const isSuperuser = user.type === 'superuser';
    return (verb, resourceType, opts) =>
      canWith(user.permissions, user.id, isSuperuser, verb, resourceType, opts);
  }, [user]);
}
