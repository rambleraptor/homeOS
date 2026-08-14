/**
 * Tests for the Connected apps settings section: the empty state, rendering a
 * connected OAuth app with its access level, and the disconnect confirm flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ToastProvider } from '@rambleraptor/homestead-core/shared/components/ToastProvider';
import { ConnectedApps } from '../components/ConnectedApps';
import { useConnectedApps } from '../hooks/useConnectedApps';
import { useRevokeConnectedApp } from '../hooks/useRevokeConnectedApp';

// Radix primitives (ConfirmDialog) measure with ResizeObserver, absent in jsdom.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as never);

vi.mock('../hooks/useConnectedApps', () => ({ useConnectedApps: vi.fn() }));
vi.mock('../hooks/useRevokeConnectedApp', () => ({ useRevokeConnectedApp: vi.fn() }));

const renderSection = () =>
  render(
    <ToastProvider>
      <ConnectedApps />
    </ToastProvider>,
  );

describe('ConnectedApps', () => {
  const revokeAsync = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRevokeConnectedApp).mockReturnValue({
      mutateAsync: revokeAsync,
      isPending: false,
    } as never);
  });

  it('shows the empty state when nothing is connected', () => {
    vi.mocked(useConnectedApps).mockReturnValue({ data: [], isLoading: false } as never);
    renderSection();
    expect(screen.getByTestId('no-connected-apps')).toBeInTheDocument();
  });

  it('renders a connected app with its name and access level', () => {
    vi.mocked(useConnectedApps).mockReturnValue({
      data: [
        {
          client_id: 'client-a',
          client_name: 'Claude MCP',
          scope: 'homestead:read',
          audience: null,
          session_count: 1,
          connected_at: '2026-01-01T00:00:00Z',
          expires_at: '2026-02-01T00:00:00Z',
        },
      ],
      isLoading: false,
    } as never);
    renderSection();
    expect(screen.getByText('Claude MCP')).toBeInTheDocument();
    expect(screen.getByText('Read only')).toBeInTheDocument();
    expect(screen.getByTestId('connected-app-row')).toBeInTheDocument();
  });

  it('disconnects an app through the confirm dialog', async () => {
    vi.mocked(useConnectedApps).mockReturnValue({
      data: [
        {
          client_id: 'client-a',
          client_name: 'Claude MCP',
          scope: 'homestead:write',
          audience: null,
          session_count: 2,
          connected_at: '2026-01-01T00:00:00Z',
          expires_at: '2026-02-01T00:00:00Z',
        },
      ],
      isLoading: false,
    } as never);
    renderSection();

    expect(screen.getByText('Read & write')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('disconnect-app'));
    // Confirm in the dialog (the confirm button also reads "Disconnect").
    const confirmButtons = screen.getAllByRole('button', { name: /disconnect/i });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(revokeAsync).toHaveBeenCalledWith('client-a'));
  });
});
