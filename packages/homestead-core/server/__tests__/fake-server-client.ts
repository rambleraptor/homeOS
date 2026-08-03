/**
 * A fake {@link HomesteadClient} for unit tests that mock `../client`.
 *
 * The real server callers go through `serverClient(token)` and the fluent
 * `collection().record().collection()` refs. This fake records every operation
 * against its fully-resolved engine path and drives behavior off one spy per
 * verb, so a test can assert `createFn` was called with `('/users/u1/notifications', body)`
 * — the path encoding replaces the old `(plural, id, parent)` argument tuples.
 */

import { vi } from 'vitest';

export function createFakeServerClient() {
  const getFn = vi.fn(async (_path: string): Promise<unknown> => ({}));
  const listAllFn = vi.fn(async (_path: string, _opts?: unknown): Promise<unknown[]> => []);
  const createFn = vi.fn(async (_path: string, _body: unknown): Promise<unknown> => ({}));
  const updateFn = vi.fn(async (_path: string, _body: unknown): Promise<unknown> => ({}));
  const deleteFn = vi.fn(async (_path: string, _opts?: unknown): Promise<void> => undefined);
  const invokeFn = vi.fn(async (_path: string, _verb: string, _body?: unknown): Promise<unknown> => ({}));
  const downloadFn = vi.fn(async (_path: string, _field: string): Promise<Blob> => new Blob());

  function collection(path: string): Record<string, unknown> {
    return {
      listAll: (opts?: unknown) => listAllFn(path, opts),
      async *list(opts?: unknown) {
        for (const record of await listAllFn(path, opts)) yield record;
      },
      page: async (opts?: unknown) => ({
        records: await listAllFn(path, opts),
        nextPageToken: undefined,
      }),
      get: (id: string) => getFn(`${path}/${id}`),
      create: (body: unknown) => createFn(path, body),
      record: (id: string) => recordRef(`${path}/${id}`),
      invoke: (verb: string, body?: unknown) => invokeFn(path, verb, body),
    };
  }

  function recordRef(path: string): Record<string, unknown> {
    return {
      path,
      get: () => getFn(path),
      update: (body: unknown) => updateFn(path, body),
      delete: (opts?: unknown) => deleteFn(path, opts),
      collection: (plural: string) => collection(`${path}/${plural}`),
      download: (field: string) => downloadFn(path, field),
      invoke: (verb: string, body?: unknown) => invokeFn(path, verb, body),
    };
  }

  const client = {
    collection: (plural: string) => collection(`/${plural}`),
    request: vi.fn(),
    raw: vi.fn(),
  };

  return { client, getFn, listAllFn, createFn, updateFn, deleteFn, invokeFn, downloadFn };
}

export type FakeServerClient = ReturnType<typeof createFakeServerClient>;

/** Mirror of `collectionAt` from `../client`, resolving against a fake client. */
export function fakeCollectionAt(
  hs: { collection: (plural: string) => Record<string, unknown> },
  plural: string,
  parent?: readonly string[],
): Record<string, unknown> {
  if (!parent || parent.length === 0) return hs.collection(plural);
  let record = (hs.collection(parent[0]).record as (id: string) => Record<string, unknown>)(
    parent[1],
  );
  for (let i = 2; i < parent.length; i += 2) {
    const child = (record.collection as (p: string) => Record<string, unknown>)(parent[i]);
    record = (child.record as (id: string) => Record<string, unknown>)(parent[i + 1]);
  }
  return (record.collection as (p: string) => Record<string, unknown>)(plural);
}
