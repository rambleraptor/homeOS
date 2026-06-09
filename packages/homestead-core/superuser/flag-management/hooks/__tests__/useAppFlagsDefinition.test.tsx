/**
 * Tests for `useAppFlagsDefinition` — the Flag Management page
 * sources its flag list exclusively from aepbase's `app-flag`
 * resource definition. The parser has to convert the schema properties
 * (which bake enum options + declared defaults into the description
 * text because aepbase strips those JSON-schema fields on round-trip)
 * back into a `AppFlagDefs` tree.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { aepbase, AepbaseError } from '@rambleraptor/homestead-core/api/aepbase';
import { useAppFlagsDefinition } from '../useAppFlagsDefinition';

const createWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

describe('useAppFlagsDefinition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports the resource as missing when aepbase 404s', async () => {
    vi.mocked(aepbase.get).mockRejectedValue(
      new AepbaseError(404, 'not found', '/aep-resource-definitions/app-flag'),
    );

    const { result } = renderHook(() => useAppFlagsDefinition(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isMissing).toBe(true);
    expect(result.current.defs).toEqual({});
  });

  it('parses enum flags with defaults out of the description', async () => {
    vi.mocked(aepbase.get).mockResolvedValue({
      schema: {
        properties: {
          settings__theme: {
            type: 'string',
            description:
              'Color theme for the app. (default: light) (one of: light, dark)',
          },
        },
      },
    });

    const { result } = renderHook(() => useAppFlagsDefinition(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isMissing).toBe(false);
    expect(result.current.defs.settings.theme).toEqual({
      type: 'enum',
      label: 'Theme',
      description: 'Color theme for the app.',
      options: ['light', 'dark'],
      default: 'light',
    });
  });

  it('parses primitive flag types and coerces the default to the declared type', async () => {
    vi.mocked(aepbase.get).mockResolvedValue({
      schema: {
        properties: {
          gift_cards__show_archived: {
            type: 'boolean',
            description: 'Show archived gift cards. (default: false)',
          },
          groceries__refill_threshold: {
            type: 'number',
            description: 'How many items trigger a refill reminder. (default: 3)',
          },
        },
      },
    });

    const { result } = renderHook(() => useAppFlagsDefinition(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.defs['gift-cards'].show_archived).toEqual({
      type: 'boolean',
      label: 'Show archived',
      description: 'Show archived gift cards.',
      default: false,
    });
    expect(result.current.defs.groceries.refill_threshold).toEqual({
      type: 'number',
      label: 'Refill threshold',
      description: 'How many items trigger a refill reminder.',
      default: 3,
    });
  });
});
