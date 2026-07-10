/**
 * Generic offline mutation factory — tested independently of any app.
 *
 * Mirrors the proven groceries scenarios (optimistic add, error rollback,
 * tempId reconciliation between create and a follow-up update/delete) but
 * against a synthetic "thingy" resource so failures point at the factory,
 * not at app-specific code.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { aepbase } from '../aepbase';
import {
  clearResourceMetaRegistry,
  clearTempIdMaps,
  newTempId,
  registerResourceMutationDefaults,
  resourceMutationKeys,
} from '../registerResourceMutationDefaults';
import { queryKeys } from '../queryClient';

interface Thingy {
  id: string;
  name: string;
  done?: boolean;
}

const KEYS = resourceMutationKeys('test-mod', 'thingy');
const LIST_KEY = queryKeys.app('test-mod').resource('thingy').list();

function makeClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  registerResourceMutationDefaults<Thingy, { name: string; tempId: string }>(client, {
    appId: 'test-mod',
    singular: 'thingy',
    plural: 'thingies',
  });
  return client;
}

async function run<TData = unknown, TVars = unknown>(
  client: QueryClient,
  mutationKey: readonly unknown[],
  variables: TVars,
): Promise<TData> {
  const observer = new MutationObserver<TData, Error, TVars>(client, {
    mutationKey: mutationKey as unknown[],
  });
  try {
    return await observer.mutate(variables);
  } finally {
    observer.reset();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  clearTempIdMaps();
  clearResourceMetaRegistry();
});

describe('create', () => {
  it('inserts an optimistic record and reconciles to the server id on success', async () => {
    const client = makeClient();
    client.setQueryData<Thingy[]>(LIST_KEY, []);
    vi.mocked(aepbase.create).mockResolvedValueOnce({ id: 'srv-1', name: 'Foo' });

    const tempId = newTempId();
    await run(client, KEYS.create, { name: 'Foo', tempId });

    const list = client.getQueryData<Thingy[]>(LIST_KEY) ?? [];
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('srv-1');
    expect(aepbase.create).toHaveBeenCalledWith('thingies', expect.objectContaining({ name: 'Foo' }));
  });

  it('rolls back the cache when the server rejects', async () => {
    const client = makeClient();
    const seed: Thingy[] = [{ id: 'pre', name: 'Pre' }];
    client.setQueryData<Thingy[]>(LIST_KEY, seed);
    vi.mocked(aepbase.create).mockRejectedValueOnce(new Error('boom'));

    await expect(
      run(client, KEYS.create, { name: 'New', tempId: newTempId() }),
    ).rejects.toThrow();

    expect(client.getQueryData<Thingy[]>(LIST_KEY)).toEqual(seed);
  });
});

describe('update tempId reconciliation', () => {
  it('rewrites a follow-up update from tempId to the server id', async () => {
    const client = makeClient();
    client.setQueryData<Thingy[]>(LIST_KEY, []);
    vi.mocked(aepbase.create).mockResolvedValueOnce({ id: 'srv-2', name: 'Bar' });
    vi.mocked(aepbase.update).mockResolvedValueOnce({ id: 'srv-2', name: 'Bar', done: true });

    const tempId = newTempId();
    await run(client, KEYS.create, { name: 'Bar', tempId });
    await run(client, KEYS.update, { id: tempId, data: { done: true } });

    expect(aepbase.update).toHaveBeenCalledWith('thingies', 'srv-2', { done: true });
  });
});

describe('delete tempId reconciliation', () => {
  it('cancels a pending create when delete fires before it resolves', async () => {
    const client = makeClient();
    client.setQueryData<Thingy[]>(LIST_KEY, []);

    let resolveCreate!: () => void;
    vi.mocked(aepbase.create).mockImplementationOnce(
      () =>
        new Promise<Thingy>((res) => {
          resolveCreate = () => res({ id: 'srv-3', name: 'Baz' });
        }),
    );

    const tempId = newTempId();
    const createPromise = run(client, KEYS.create, { name: 'Baz', tempId });

    await vi.waitFor(() => {
      expect(client.getQueryData<Thingy[]>(LIST_KEY) ?? []).toHaveLength(1);
    });

    await run(client, KEYS.delete, tempId);

    expect(aepbase.remove).not.toHaveBeenCalled();
    expect(client.getQueryData<Thingy[]>(LIST_KEY) ?? []).toHaveLength(0);

    resolveCreate();
    await createPromise.catch(() => undefined);
  });
});

describe('nested resources (convention-driven from `parents`)', () => {
  const CC = 'credit-cards';

  function makeNestedClient(): QueryClient {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false },
      },
    });
    // Order is irrelevant — the walk consults the shared registry at mutate
    // time, by which point every resource has self-published its metadata.
    registerResourceMutationDefaults(client, {
      appId: CC,
      singular: 'credit-card',
      plural: 'credit-cards',
    });
    registerResourceMutationDefaults(client, {
      appId: CC,
      singular: 'perk',
      plural: 'perks',
      parents: ['credit-card'],
    });
    registerResourceMutationDefaults(client, {
      appId: CC,
      singular: 'redemption',
      plural: 'redemptions',
      parents: ['perk'],
    });
    return client;
  }

  it('creates a one-level child under its parent, stripping the FK from the body but keeping it on the optimistic record', async () => {
    const client = makeNestedClient();
    const perkList = queryKeys.app(CC).resource('perk').list();
    client.setQueryData(perkList, []);

    // Defer the server response so we can inspect the optimistic record while
    // the create is still in flight (before reconciliation replaces it).
    let resolveCreate!: () => void;
    vi.mocked(aepbase.create).mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolveCreate = () => res({ id: 'perk-1', name: 'Dining' });
        }),
    );

    const createPromise = run(client, resourceMutationKeys(CC, 'perk').create, {
      credit_card: 'card-1',
      name: 'Dining',
      tempId: newTempId(),
    });

    // The optimistic record carries the FK for the compute-hook joins...
    await vi.waitFor(() => {
      const cached = client.getQueryData<Array<{ credit_card?: string }>>(perkList);
      expect(cached?.[0]?.credit_card).toBe('card-1');
    });

    // ...but the wire body has it stripped (it's path-encoded instead).
    expect(aepbase.create).toHaveBeenCalledWith(
      'perks',
      expect.objectContaining({ name: 'Dining' }),
      { parent: ['credit-cards', 'card-1'] },
    );
    expect(vi.mocked(aepbase.create).mock.calls[0][1]).not.toHaveProperty('credit_card');

    resolveCreate();
    await createPromise;
  });

  it('creates a two-level grandchild by walking the parent cache for the grandparent id', async () => {
    const client = makeNestedClient();
    client.setQueryData(queryKeys.app(CC).resource('perk').list(), [
      { id: 'perk-1', credit_card: 'card-1', name: 'Dining' },
    ]);
    client.setQueryData(queryKeys.app(CC).resource('redemption').list(), []);
    vi.mocked(aepbase.create).mockResolvedValueOnce({ id: 'red-1', amount: 10 });

    await run(client, resourceMutationKeys(CC, 'redemption').create, {
      perk: 'perk-1',
      amount: 10,
      tempId: newTempId(),
    });

    expect(aepbase.create).toHaveBeenCalledWith(
      'redemptions',
      expect.objectContaining({ amount: 10 }),
      { parent: ['credit-cards', 'card-1', 'perks', 'perk-1'] },
    );
    expect(vi.mocked(aepbase.create).mock.calls[0][1]).not.toHaveProperty('perk');
  });

  it('deletes a child using the parent chain resolved before optimistic removal', async () => {
    const client = makeNestedClient();
    client.setQueryData(queryKeys.app(CC).resource('perk').list(), [
      { id: 'perk-1', credit_card: 'card-1', name: 'Dining' },
    ]);
    vi.mocked(aepbase.remove).mockResolvedValueOnce(undefined);

    await run(client, resourceMutationKeys(CC, 'perk').delete, 'perk-1');

    expect(aepbase.remove).toHaveBeenCalledWith('perks', 'perk-1', {
      parent: ['credit-cards', 'card-1'],
      force: true,
    });
  });
});
