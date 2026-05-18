/**
 * Tests for the module-authorization data syncer.
 *
 * The syncer pushes a single row keyed by `default` via PUT (Apply).
 * The resource definition itself is part of BUILTIN_RESOURCE_DEFS and
 * sync'd by the generic resources runner, so these tests focus on the
 * payload shape and the HTTP call.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  buildMappingJson,
  syncModuleAuthorization,
  type MappingEntry,
} from '../sync';

const BASE = 'http://aepbase.test';
const TOKEN = 'admin-token';
const SILENT_LOGGER = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const mappings: MappingEntry[] = [
  { plural: 'transactions', singular: 'transaction', module_id: 'gift-cards' },
  { plural: 'gift-cards', singular: 'gift-card', module_id: 'gift-cards' },
  { plural: 'recipes', singular: 'recipe', module_id: 'recipes' },
];

describe('buildMappingJson', () => {
  it('sorts entries by plural so the JSON shape is stable', () => {
    const json = buildMappingJson(mappings);
    const parsed = JSON.parse(json) as { mappings: MappingEntry[] };
    expect(parsed.mappings.map((m) => m.plural)).toEqual([
      'gift-cards',
      'recipes',
      'transactions',
    ]);
  });

  it('preserves the singular and module_id for each entry', () => {
    const json = buildMappingJson(mappings);
    const parsed = JSON.parse(json) as { mappings: MappingEntry[] };
    const recipes = parsed.mappings.find((m) => m.plural === 'recipes');
    expect(recipes).toEqual({
      plural: 'recipes',
      singular: 'recipe',
      module_id: 'recipes',
    });
  });
});

describe('syncModuleAuthorization', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it('PUTs the mapping to /module-authorizations/default', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const result = await syncModuleAuthorization({
      aepbaseUrl: BASE,
      token: TOKEN,
      mappings,
      logger: SILENT_LOGGER,
    });

    expect(result).toEqual({ action: 'applied', count: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/module-authorizations/default`);
    expect(init.method).toBe('PUT');
    expect(init.headers).toMatchObject({
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    });
    const body = JSON.parse(init.body as string) as { mapping_json: string };
    expect(typeof body.mapping_json).toBe('string');
    const parsed = JSON.parse(body.mapping_json) as { mappings: MappingEntry[] };
    expect(parsed.mappings).toHaveLength(3);
  });

  it('throws when aepbase rejects the request', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('schema mismatch', { status: 400 }),
    );

    await expect(
      syncModuleAuthorization({
        aepbaseUrl: BASE,
        token: TOKEN,
        mappings,
        logger: SILENT_LOGGER,
      }),
    ).rejects.toThrow(/400.*schema mismatch/);
  });
});
