/**
 * Generic offline-capable mutation defaults for any aepbase resource.
 *
 * Mirrors what groceries did inline but per-resource: register `create`,
 * `update`, `delete` defaults on the QueryClient under stable mutation keys,
 * with optimistic cache writes, error rollback, temp-id reconciliation,
 * and online-gated invalidation. The defaults must live on the QueryClient
 * (not in a `useMutation` closure) so paused mutations can replay across a
 * page reload after `PersistQueryClientProvider` rehydrates them.
 */

import type { QueryClient, MutationOptions } from '@tanstack/react-query';
import { onlineManager } from '@tanstack/react-query';
import { aepbase, type ParentPath } from './aepbase';
import { queryKeys } from './queryClient';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Temp-id helpers
// ---------------------------------------------------------------------------

export const TEMP_ID_PREFIX = 'tmp_';

export function isTempId(id: string): boolean {
  return id.startsWith(TEMP_ID_PREFIX);
}

export function newTempId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${TEMP_ID_PREFIX}${crypto.randomUUID()}`;
  }
  return `${TEMP_ID_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// One reconciliation map per (moduleId, singular). The maps survive across
// QueryClients in the same JS realm so a page reload that recreates the
// client still finds prior temp→real mappings during queue replay.
const tempIdMaps = new Map<string, Map<string, string>>();

function tempIdMap(moduleId: string, singular: string): Map<string, string> {
  const key = `${moduleId}:${singular}`;
  let map = tempIdMaps.get(key);
  if (!map) {
    map = new Map();
    tempIdMaps.set(key, map);
  }
  return map;
}

/** Reset all temp-id maps. Test-only — runtime callers shouldn't need this. */
export function clearTempIdMaps(): void {
  tempIdMaps.clear();
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CreateVarsBase {
  tempId: string;
}

export interface UpdateVars<U = Record<string, unknown>> {
  id: string;
  data: U;
}

export interface ResourceMutationKeys {
  create: readonly unknown[];
  update: readonly unknown[];
  delete: readonly unknown[];
}

export interface ResourceMutationOpts<
  T extends { id: string },
  C extends CreateVarsBase,
  U,
> {
  moduleId: string;
  /** Resource singular, used in mutation keys (`create-${singular}`). */
  singular: string;
  /** aepbase collection plural (the URL segment). */
  plural: string;
  /** Override the cache key the factory mutates. Defaults to `queryKeys.module(moduleId).list()`. */
  listQueryKey?: readonly unknown[];
  /** Build the URL parent chain for nested resources. */
  parentPath?: (vars: C | UpdateVars<U> | string) => ParentPath | undefined;
  /** Project create vars to the aepbase POST body. Default: spread minus tempId, inject created_by. */
  toCreateBody?: (vars: C) => Record<string, unknown> | FormData;
  /** Project update data to the aepbase PATCH body. Default: pass-through. */
  toUpdateBody?: (data: U) => Record<string, unknown> | FormData;
  /** Construct the optimistic record. Default: spread vars, set id=tempId, fill timestamps. */
  buildOptimistic?: (vars: C) => T;
  /** Sort the cache after each mutation. Default: insertion order. */
  sort?: (records: T[]) => T[];
  /** Apply the create response to the cache (replace optimistic record). Default: replace by id. */
  onCreateSuccess?: (created: T, vars: C, qc: QueryClient) => void;
  /**
   * Optimistic cascade applied inside the delete `onMutate` (before any
   * network call) and reversed in `onError`. Both callbacks must be pure
   * functions of (qc, snapshot) so the snapshot can survive serialization
   * into the persisted mutation queue. Use for things like "unset
   * foreign-key references on related records when their parent is
   * deleted".
   */
  cascadeDelete?: {
    apply: (deletedId: string, qc: QueryClient) => unknown;
    rollback: (snapshot: unknown, qc: QueryClient) => void;
  };
  /** Aliases for legacy mutation keys. Bind the same defaults under these keys too. */
  legacyKeys?: Partial<ResourceMutationKeys>;
}

// ---------------------------------------------------------------------------
// Key builder
// ---------------------------------------------------------------------------

export function resourceMutationKeys(
  moduleId: string,
  singular: string,
): ResourceMutationKeys {
  return {
    create: ['module', moduleId, `create-${singular}`] as const,
    update: ['module', moduleId, `update-${singular}`] as const,
    delete: ['module', moduleId, `delete-${singular}`] as const,
  };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

const NON_QUEUEABLE_META = { offlineQueueable: false } as const;

function nowIso(): string {
  return new Date().toISOString();
}

export function registerResourceMutationDefaults<
  T extends { id: string },
  C extends CreateVarsBase = CreateVarsBase & Record<string, unknown>,
  U = Record<string, unknown>,
>(qc: QueryClient, opts: ResourceMutationOpts<T, C, U>): ResourceMutationKeys {
  const {
    moduleId,
    singular,
    plural,
    listQueryKey: listQueryKeyOpt,
    parentPath,
    toCreateBody,
    toUpdateBody,
    buildOptimistic,
    sort,
    onCreateSuccess,
    cascadeDelete,
    legacyKeys,
  } = opts;

  const listKey = listQueryKeyOpt ?? queryKeys.module(moduleId).list();
  const idMap = tempIdMap(moduleId, singular);
  const keys = resourceMutationKeys(moduleId, singular);

  function resolveId(id: string): string {
    return idMap.get(id) ?? id;
  }

  function defaultCreateBody(vars: C): Record<string, unknown> {
    const { tempId: _temp, ...rest } = vars as unknown as Record<string, unknown> & {
      tempId: string;
    };
    void _temp;
    const userId = aepbase.getCurrentUser?.()?.id;
    if (userId && !('created_by' in rest)) {
      rest.created_by = `users/${userId}`;
    }
    return rest;
  }

  function defaultOptimistic(vars: C): T {
    const ts = nowIso();
    const { tempId, ...rest } = vars as unknown as Record<string, unknown> & {
      tempId: string;
    };
    // Both timestamp shapes are filled — aepbase records use `create_time/update_time`,
    // PB-era types still expose `created/updated`. Modules can override `buildOptimistic`
    // when their type is stricter.
    return {
      id: tempId,
      ...rest,
      create_time: ts,
      update_time: ts,
      created: ts,
      updated: ts,
    } as unknown as T;
  }

  function defaultCreateSuccess(created: T, vars: C, qcInner: QueryClient): void {
    idMap.set(vars.tempId, created.id);
    const list = qcInner.getQueryData<T[]>(listKey) ?? [];
    qcInner.setQueryData<T[]>(
      listKey,
      applySort(list.map((r) => (r.id === vars.tempId ? created : r))),
    );
  }

  const buildBody = toCreateBody ?? defaultCreateBody;
  const projectUpdate =
    toUpdateBody ?? ((d: U) => d as unknown as Record<string, unknown>);
  const optimistic = buildOptimistic ?? defaultOptimistic;
  const applySort = sort ?? ((rs: T[]) => rs);
  const handleCreateSuccess = onCreateSuccess ?? defaultCreateSuccess;

  // ---- create -----------------------------------------------------------
  const createDef: MutationOptions<T, Error, C, { previous: T[] }> = {
    networkMode: 'online',
    mutationFn: async (vars: C) => {
      const body = buildBody(vars);
      const parent = parentPath?.(vars);
      return parent
        ? aepbase.create<T>(plural, body, { parent })
        : aepbase.create<T>(plural, body);
    },
    onMutate: async (vars: C) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<T[]>(listKey) ?? [];
      const record = optimistic(vars);
      qc.setQueryData<T[]>(listKey, applySort([...previous, record]));
      return { previous };
    },
    onSuccess: (created, vars) => {
      handleCreateSuccess(created, vars, qc);
    },
    onError: (error, _vars, context) => {
      logger.error(`Failed to create ${singular}`, error);
      if (context?.previous !== undefined) {
        qc.setQueryData<T[]>(listKey, context.previous);
      }
    },
    onSettled: () => {
      if (onlineManager.isOnline()) {
        qc.invalidateQueries({ queryKey: listKey });
      }
    },
  };

  qc.setMutationDefaults(keys.create, createDef);
  if (legacyKeys?.create) qc.setMutationDefaults(legacyKeys.create, createDef);

  // ---- update -----------------------------------------------------------
  const updateDef: MutationOptions<
    T | undefined,
    Error,
    UpdateVars<U>,
    { previous: T[] }
  > = {
    networkMode: 'online',
    mutationFn: async (vars: UpdateVars<U>) => {
      const realId = resolveId(vars.id);
      if (isTempId(realId)) {
        // Backing create still pending. Continue it before issuing the
        // update. tempIds are crypto-random so a global search by tempId
        // is unambiguous (and works across legacy-key aliases).
        const matching = qc
          .getMutationCache()
          .getAll()
          .find(
            (m) =>
              (m.state.variables as CreateVarsBase | undefined)?.tempId === realId,
          );
        if (matching) {
          await matching.continue().catch(() => undefined);
          const resolved = resolveId(vars.id);
          if (!isTempId(resolved)) {
            const parent = parentPath?.(vars);
            return parent
              ? aepbase.update<T>(plural, resolved, projectUpdate(vars.data), { parent })
              : aepbase.update<T>(plural, resolved, projectUpdate(vars.data));
          }
        }
        throw new Error(
          `Cannot update ${singular} ${vars.id}: backing create has not resolved`,
        );
      }
      const parent = parentPath?.(vars);
      return parent
        ? aepbase.update<T>(plural, realId, projectUpdate(vars.data), { parent })
        : aepbase.update<T>(plural, realId, projectUpdate(vars.data));
    },
    onMutate: async (vars: UpdateVars<U>) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<T[]>(listKey) ?? [];
      const ts = nowIso();
      qc.setQueryData<T[]>(
        listKey,
        applySort(
          previous.map((r) =>
            r.id === vars.id
              ? ({
                  ...r,
                  ...(vars.data as object),
                  update_time: ts,
                  updated: ts,
                } as T)
              : r,
          ),
        ),
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      logger.error(`Failed to update ${singular}`, error);
      if (context?.previous !== undefined) {
        qc.setQueryData<T[]>(listKey, context.previous);
      }
    },
    onSettled: () => {
      if (onlineManager.isOnline()) {
        qc.invalidateQueries({ queryKey: listKey });
      }
    },
  };

  qc.setMutationDefaults(keys.update, updateDef);
  if (legacyKeys?.update) qc.setMutationDefaults(legacyKeys.update, updateDef);

  // ---- delete -----------------------------------------------------------
  type DeleteContext = { previous: T[]; cascade?: unknown };
  const deleteDef: MutationOptions<string, Error, string, DeleteContext> = {
    networkMode: 'online',
    mutationFn: async (id: string) => {
      const realId = resolveId(id);
      if (isTempId(realId)) {
        // Backing create still pending. Cancel it; nothing on server to delete.
        qc.getMutationCache()
          .getAll()
          .filter(
            (m) =>
              (m.state.variables as CreateVarsBase | undefined)?.tempId === realId,
          )
          .forEach((m) => m.destroy());
        return realId;
      }
      const parent = parentPath?.(id);
      if (parent) {
        await aepbase.remove(plural, realId, { parent });
      } else {
        await aepbase.remove(plural, realId);
      }
      return realId;
    },
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<T[]>(listKey) ?? [];
      qc.setQueryData<T[]>(
        listKey,
        previous.filter((r) => r.id !== id),
      );
      const cascade = cascadeDelete ? cascadeDelete.apply(id, qc) : undefined;
      return { previous, cascade };
    },
    onError: (error, _id, context) => {
      logger.error(`Failed to delete ${singular}`, error);
      if (context?.previous !== undefined) {
        qc.setQueryData<T[]>(listKey, context.previous);
      }
      if (cascadeDelete && context?.cascade !== undefined) {
        cascadeDelete.rollback(context.cascade, qc);
      }
    },
    onSettled: () => {
      if (onlineManager.isOnline()) {
        qc.invalidateQueries({ queryKey: listKey });
      }
    },
  };

  qc.setMutationDefaults(keys.delete, deleteDef);
  if (legacyKeys?.delete) qc.setMutationDefaults(legacyKeys.delete, deleteDef);

  return keys;
}

export { NON_QUEUEABLE_META };
