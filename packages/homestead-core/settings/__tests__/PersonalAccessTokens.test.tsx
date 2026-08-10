/**
 * Tests for the Personal Access Tokens settings section: the empty state, the
 * scope picker sourced from the caller's own grants, and the create flow that
 * reveals the one-time secret.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ToastProvider } from '@rambleraptor/homestead-core/shared/components/ToastProvider';
import { PersonalAccessTokens } from '../components/PersonalAccessTokens';
import { usePersonalAccessTokens } from '../hooks/usePersonalAccessTokens';
import { useMintPersonalAccessToken } from '../hooks/useMintPersonalAccessToken';
import { useRevokePersonalAccessToken } from '../hooks/useRevokePersonalAccessToken';
import { useTokenScopeOptions } from '../hooks/useTokenScopeOptions';

// Radix primitives (Checkbox/Modal) measure with ResizeObserver, absent in jsdom.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as never);

vi.mock('../hooks/usePersonalAccessTokens', () => ({ usePersonalAccessTokens: vi.fn() }));
vi.mock('../hooks/useMintPersonalAccessToken', () => ({ useMintPersonalAccessToken: vi.fn() }));
vi.mock('../hooks/useRevokePersonalAccessToken', () => ({ useRevokePersonalAccessToken: vi.fn() }));
vi.mock('../hooks/useTokenScopeOptions', async (importOriginal) => {
  const actual = (await importOriginal()) as object;
  return { ...actual, useTokenScopeOptions: vi.fn() };
});

const renderSection = () =>
  render(
    <ToastProvider>
      <PersonalAccessTokens />
    </ToastProvider>,
  );

describe('PersonalAccessTokens', () => {
  const mintAsync = vi.fn().mockResolvedValue({ token: 'hsd_pat_secretvalue', id: 'p1' });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePersonalAccessTokens).mockReturnValue({ data: [], isLoading: false } as never);
    vi.mocked(useTokenScopeOptions).mockReturnValue({
      data: [
        { key: 'all:', label: 'Everything', target_scope: 'all', maxCapability: 'write' },
      ],
      isLoading: false,
    } as never);
    vi.mocked(useMintPersonalAccessToken).mockReturnValue({
      mutateAsync: mintAsync,
      isPending: false,
    } as never);
    vi.mocked(useRevokePersonalAccessToken).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
  });

  it('shows the empty state and the scopes derived from the caller’s grants', () => {
    renderSection();
    expect(screen.getByTestId('no-tokens')).toBeInTheDocument();
    expect(screen.getByText('Everything')).toBeInTheDocument();
  });

  it('mints a token with the chosen scope and reveals the secret once', async () => {
    renderSection();

    fireEvent.change(screen.getByTestId('token-name'), { target: { value: 'CI bot' } });
    // Include the "Everything" scope.
    fireEvent.click(screen.getByTestId('scope-all:'));
    fireEvent.click(screen.getByTestId('create-token'));

    await waitFor(() =>
      expect(mintAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'CI bot',
          scopes: [{ capability: 'write', target_scope: 'all', target_app: undefined, resource_type: undefined }],
        }),
      ),
    );

    // The one-time secret is surfaced.
    await waitFor(() =>
      expect(screen.getByTestId('minted-secret')).toHaveTextContent('hsd_pat_secretvalue'),
    );
  });
});
