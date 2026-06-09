/**
 * Tests for the app-flags schema syncer.
 *
 * The syncer is pure HTTP against aepbase's resource-definition API,
 * so these mock `fetch` directly and assert the request sequence.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { syncAppFlagsSchema } from '../sync';
import type { AppFlagDefs } from '@rambleraptor/homestead-core/settings/flags';

const defs: AppFlagDefs = {
  settings: {
    theme: {
      type: 'enum',
      label: 'Theme',
      description: 'Color theme for the app.',
      options: ['light', 'dark'],
      default: 'light',
    },
  },
};

const BASE = 'http://aepbase.test';
const TOKEN = 'admin-token';
const SILENT_LOGGER = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe('syncAppFlagsSchema', () => {
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

  it('creates the resource definition when none exists', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('not found', { status: 404 }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response('{}', { status: 200 }),
    );

    const result = await syncAppFlagsSchema({
      aepbaseUrl: BASE,
      token: TOKEN,
      defs,
      logger: SILENT_LOGGER,
    });

    expect(result.action).toBe('created');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [postUrl, postInit] = fetchMock.mock.calls[1];
    expect(postUrl).toBe(`${BASE}/aep-resource-definitions?id=app-flag`);
    expect(postInit.method).toBe('POST');
    const body = JSON.parse(postInit.body as string);
    expect(body.singular).toBe('app-flag');
    expect(body.plural).toBe('app-flags');
    expect(body.schema.properties.settings__theme.type).toBe('string');
  });

  it('is a no-op when the existing schema already matches', async () => {
    const existingSchema = {
      type: 'object',
      properties: {
        settings__theme: {
          type: 'string',
          description:
            'Color theme for the app. (default: light) (one of: light, dark)',
        },
      },
    };
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          singular: 'app-flag',
          schema: existingSchema,
        }),
        { status: 200 },
      ),
    );

    const result = await syncAppFlagsSchema({
      aepbaseUrl: BASE,
      token: TOKEN,
      defs,
      logger: SILENT_LOGGER,
    });

    expect(result.action).toBe('noop');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [getUrl] = fetchMock.mock.calls[0];
    expect(getUrl).toBe(`${BASE}/aep-resource-definitions/app-flag`);
  });

  it('PATCHes the resource definition when the schema has drifted', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          singular: 'app-flag',
          schema: {
            type: 'object',
            properties: { old_field: { type: 'string' } },
          },
        }),
        { status: 200 },
      ),
    );
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const result = await syncAppFlagsSchema({
      aepbaseUrl: BASE,
      token: TOKEN,
      defs,
      logger: SILENT_LOGGER,
    });

    expect(result.action).toBe('updated');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [patchUrl, patchInit] = fetchMock.mock.calls[1];
    expect(patchUrl).toBe(`${BASE}/aep-resource-definitions/app-flag`);
    expect(patchInit.method).toBe('PATCH');
    expect(patchInit.headers['Content-Type']).toBe(
      'application/merge-patch+json',
    );
    const patchBody = JSON.parse(patchInit.body as string);
    expect(patchBody.schema.properties.settings__theme).toBeDefined();
  });

  it('throws when aepbase returns an unexpected status on GET', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('boom', { status: 500 }),
    );

    await expect(
      syncAppFlagsSchema({
        aepbaseUrl: BASE,
        token: TOKEN,
        defs,
        logger: SILENT_LOGGER,
      }),
    ).rejects.toThrow(/500/);
  });
});
