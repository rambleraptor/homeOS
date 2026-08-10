/**
 * Tests for the Personal Access Tokens settings section: the empty state and
 * the create flow, which now uses the shared grant editor (the same rows the
 * role editor uses) and reveals the one-time secret.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ToastProvider } from '@rambleraptor/homestead-core/shared/components/ToastProvider';
import { PersonalAccessTokens } from '../components/PersonalAccessTokens';
import { usePersonalAccessTokens } from '../hooks/usePersonalAccessTokens';
import { useMintPersonalAccessToken } from '../hooks/useMintPersonalAccessToken';
import { useRevokePersonalAccessToken } from '../hooks/useRevokePersonalAccessToken';

// Radix primitives (Modal) measure with ResizeObserver, absent in jsdom.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as never);

vi.mock('../hooks/usePersonalAccessTokens', () => ({ usePersonalAccessTokens: vi.fn() }));
vi.mock('../hooks/useMintPersonalAccessToken', () => ({ useMintPersonalAccessToken: vi.fn() }));
vi.mock('../hooks/useRevokePersonalAccessToken', () => ({ useRevokePersonalAccessToken: vi.fn() }));

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
    vi.mocked(useMintPersonalAccessToken).mockReturnValue({
      mutateAsync: mintAsync,
      isPending: false,
    } as never);
    vi.mocked(useRevokePersonalAccessToken).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
  });

  it('shows the empty state and the shared grant editor', () => {
    renderSection();
    expect(screen.getByTestId('no-tokens')).toBeInTheDocument();
    // The shared grant editor's "add" control is present.
    expect(screen.getByTestId('token-add-scope')).toBeInTheDocument();
  });

  it('mints a token with a grant built in the editor and reveals the secret once', async () => {
    renderSection();

    fireEvent.change(screen.getByTestId('token-name'), { target: { value: 'CI bot' } });
    // Add a grant row and scope it to "everything".
    fireEvent.click(screen.getByTestId('token-add-scope'));
    fireEvent.change(screen.getByLabelText('capability'), { target: { value: 'write' } });
    fireEvent.change(screen.getByLabelText('scope'), { target: { value: 'all' } });
    fireEvent.click(screen.getByTestId('create-token'));

    await waitFor(() =>
      expect(mintAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'CI bot',
          scopes: [{ capability: 'write', target_scope: 'all' }],
        }),
      ),
    );

    await waitFor(() =>
      expect(screen.getByTestId('minted-secret')).toHaveTextContent('hsd_pat_secretvalue'),
    );
  });
});
