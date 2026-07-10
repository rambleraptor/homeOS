/**
 * Thin generic hooks that bind to mutation defaults registered via
 * `registerResourceMutationDefaults`. Apps wrap these to expose
 * domain-specific names (e.g. `useCreateCreditCard`).
 */

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
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
