/**
 * Tests for the module-settings schema syncer.
 *
 * The syncer is pure HTTP against aepbase's resource-definition API,
 * so these mock `fetch` directly and assert the request sequence.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { syncModuleSettingsSchema } from '../sync';
import type { ModuleSettingsDefs } from '@/modules/settings/schema';

const defs: ModuleSettingsDefs = {
  settings: {
    omnibox_access: {
      type: 'enum',
      label: 'Omnibox access',
      options: ['superuser', 'all'],
      default: 'superuser',
    },
  },
};

const BASE = 'http://aepbase.test';
const TOKEN = 'admin-token';
const SILENT_LOGGER = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe('syncModuleSettingsSchema', () => {
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

    const result = await syncModuleSettingsSchema({
      aepbaseUrl: BASE,
      token: TOKEN,
      defs,
      logger: SILENT_LOGGER,
    });

    expect(result.action).toBe('created');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [postUrl, postInit] = fetchMock.mock.calls[1];
    expect(postUrl).toBe(`${BASE}/resource-definitions`);
    expect(postInit.method).toBe('POST');
    const body = JSON.parse(postInit.body as string);
    expect(body.singular).toBe('module-setting');
    expect(body.plural).toBe('module-settings');
    const schema = JSON.parse(body.schema);
    expect(schema.properties.settings__omnibox_access.type).toBe('string');
  });

  it('is a no-op when the existing schema already matches', async () => {
    const existingSchema = {
      type: 'object',
      properties: {
        settings__omnibox_access: {
          type: 'string',
          description: 'Omnibox access (one of: superuser, all)',
        },
      },
    };
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          singular: 'module-setting',
          schema: JSON.stringify(existingSchema),
        }),
        { status: 200 },
      ),
    );

    const result = await syncModuleSettingsSchema({
      aepbaseUrl: BASE,
      token: TOKEN,
      defs,
      logger: SILENT_LOGGER,
    });

    expect(result.action).toBe('noop');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('PATCHes the resource definition when the schema has drifted', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          singular: 'module-setting',
          schema: JSON.stringify({
            type: 'object',
            properties: { old_field: { type: 'string' } },
          }),
        }),
        { status: 200 },
      ),
    );
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const result = await syncModuleSettingsSchema({
      aepbaseUrl: BASE,
      token: TOKEN,
      defs,
      logger: SILENT_LOGGER,
    });

    expect(result.action).toBe('updated');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [patchUrl, patchInit] = fetchMock.mock.calls[1];
    expect(patchUrl).toBe(`${BASE}/resource-definitions/module-setting`);
    expect(patchInit.method).toBe('PATCH');
    expect(patchInit.headers['Content-Type']).toBe(
      'application/merge-patch+json',
    );
  });

  it('throws when aepbase returns an unexpected status on GET', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('boom', { status: 500 }),
    );

    await expect(
      syncModuleSettingsSchema({
        aepbaseUrl: BASE,
        token: TOKEN,
        defs,
        logger: SILENT_LOGGER,
      }),
    ).rejects.toThrow(/500/);
  });
});
