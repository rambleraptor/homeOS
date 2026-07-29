/**
 * Thin generic hooks that bind to mutation defaults registered via
 * `registerResourceMutationDefaults`. Apps wrap these to expose
 * domain-specific names (e.g. `useCreateCreditCard`).
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  newTempId,
  resolveParentChainFromCache,
  resourceHasParents,
  resourceMutationKeys,
  type CreateVarsBase,
  type DeleteVars,
  type UpdateVars,
} from './registerResourceMutationDefaults';
import { aepbase, type ParentPath } from './aepbase';
import { queryKeys } from './queryClient';

/**
 * Build a client-side comparator equivalent to an AEP `order_by` string, so a
 * list keeps the server's ordering even for the optimistic row the mutation
 * factory appends before a refetch confirms it. Same grammar as the wire
 * param: comma-separated fields, `-` prefix for descending, whitespace
 * insignificant. Only top-level fields are supported (dotted subfields are
 * ordered server-side only); unknown fields compare equal and fall through to
 * the next term.
 */
export function comparatorFromOrderBy<T>(orderBy: string): (a: T, b: T) => number {
  const terms = orderBy
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
    .map((s) => {
      const desc = s.startsWith('-');
      return { field: (desc ? s.slice(1) : s).trim(), dir: desc ? -1 : 1 };
    });

  const cmp = (a: unknown, b: unknown): number => {
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;
    if (typeof a === 'string' || typeof b === 'string') {
      return String(a).localeCompare(String(b));
    }
    if (typeof a === 'boolean' || typeof b === 'boolean') {
      return Number(a) - Number(b);
    }
    return a < b ? -1 : a > b ? 1 : 0;
  };

  return (a, b) => {
    for (const { field, dir } of terms) {
      const c = cmp((a as Record<string, unknown>)[field], (b as Record<string, unknown>)[field]);
      if (c !== 0) return c * dir;
    }
    return 0;
  };
}

export interface ResourceListOptions<T> {
  /** aepbase collection (plural) to list, e.g. `GIFT_CARDS`. */
  plural: string;
  /**
   * AEP `order_by` (e.g. `-create_time`, `name`). Sent to the engine for
   * server-side ordering AND applied client-side via
   * `comparatorFromOrderBy`, so the optimistic row the mutation factory
   * appends lands in the right place before the next refetch.
   */
  orderBy?: string;
  /** URL parent chain for a nested resource (`[GIFT_CARDS, giftCardId]`). */
  parent?: ParentPath;
  /**
   * Cache key. Defaults to the factory's `resource(singular).list()` slot so
   * optimistic writes are visible. Parented lists needing a per-parent slot
   * pass their own key.
   */
  queryKey?: readonly unknown[];
  /** Override the derived comparator with a custom one (computed/multi-source sorts). */
  sort?: (a: T, b: T) => number;
  enabled?: boolean;
  gcTime?: number;
  staleTime?: number;
}

/**
 * Generic list-read hook: the read-side counterpart to `useResourceCreate`.
 * Wraps `useQuery` + `aepbase.list` with the standard cache key and AEP
 * ordering, collapsing the per-app `useXList` boilerplate to one call. Apps
 * wrap it to expose a domain name (e.g. `useGiftCards`).
 */
export function useResourceList<T>(
  appId: string,
  singular: string,
  options: ResourceListOptions<T>,
): UseQueryResult<T[], Error> {
  const { plural, orderBy, parent, queryKey, sort, enabled, gcTime, staleTime } = options;
  const comparator = sort ?? (orderBy ? comparatorFromOrderBy<T>(orderBy) : undefined);
  return useQuery<T[], Error>({
    queryKey: queryKey ?? queryKeys.app(appId).resource(singular).list(),
    queryFn: async (): Promise<T[]> => {
      const rows = await aepbase.list<T>(plural, { parent, orderBy });
      return comparator ? [...rows].sort(comparator) : rows;
    },
    ...(enabled === undefined ? {} : { enabled }),
    ...(gcTime === undefined ? {} : { gcTime }),
    ...(staleTime === undefined ? {} : { staleTime }),
  });
}

/**
 * Create-mutation wrapper. The hook auto-injects a stable `tempId` on each
 * call so optimistic + persisted state share one handle through the queue.
 */
export function useResourceCreate<T, V extends object>(
  appId: string,
  singular: string,
): UseMutationResult<T, Error, V> & {
  mutate: (vars: V) => void;
  mutateAsync: (vars: V) => Promise<T>;
} {
  const keys = resourceMutationKeys(appId, singular);
  const mutation = useMutation<T, Error, V & CreateVarsBase>({
    mutationKey: keys.create as unknown as readonly unknown[],
  });

  return {
    ...mutation,
    mutate: (vars: V) =>
      mutation.mutate({ ...(vars as object), tempId: newTempId() } as V & CreateVarsBase),
    mutateAsync: (vars: V) =>
      mutation.mutateAsync({
        ...(vars as object),
        tempId: newTempId(),
      } as V & CreateVarsBase),
  } as UseMutationResult<T, Error, V> & {
    mutate: (vars: V) => void;
    mutateAsync: (vars: V) => Promise<T>;
  };
}

/** Update-mutation wrapper. Variables are `{ id, data }`. */
export function useResourceUpdate<T, U = Record<string, unknown>>(
  appId: string,
  singular: string,
): UseMutationResult<T | undefined, Error, UpdateVars<U>> {
  const keys = resourceMutationKeys(appId, singular);
  return useMutation<T | undefined, Error, UpdateVars<U>>({
    mutationKey: keys.update as unknown as readonly unknown[],
  });
}

/**
 * Delete-mutation wrapper. Public variables are the record id. For a nested
 * resource the wrapper resolves the aepbase URL parent chain from cache up
 * front (before the optimistic delete removes the record) and passes it in
 * the variables, so the chain persists into the offline queue and survives a
 * reload. Top-level resources pass the bare id unchanged.
 */
export function useResourceDelete(
  appId: string,
  singular: string,
): UseMutationResult<string, Error, string> {
  const queryClient = useQueryClient();
  const keys = resourceMutationKeys(appId, singular);
  const mutation = useMutation<string, Error, DeleteVars>({
    mutationKey: keys.delete as unknown as readonly unknown[],
  });

  const toVars = (id: string): DeleteVars => {
    if (!resourceHasParents(appId, singular)) return id;
    const parent = resolveParentChainFromCache(queryClient, appId, singular, id);
    return { id, parent };
  };

  return {
    ...mutation,
    mutate: (id: string, options?: Parameters<typeof mutation.mutate>[1]) =>
      mutation.mutate(toVars(id), options),
    mutateAsync: (id: string, options?: Parameters<typeof mutation.mutateAsync>[1]) =>
      mutation.mutateAsync(toVars(id), options),
  } as unknown as UseMutationResult<string, Error, string>;
}
