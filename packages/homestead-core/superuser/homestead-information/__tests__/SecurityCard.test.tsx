/**
 * The encryption-at-rest status card. Driven by the useSecurityStatus query,
 * which we mock so the four states (loading / error / on / off) render
 * deterministically without a live endpoint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SecurityCard } from '../components/SecurityCard';
import { useSecurityStatus } from '../hooks/useSecurityStatus';

vi.mock('../hooks/useSecurityStatus', () => ({ useSecurityStatus: vi.fn() }));

const mockStatus = vi.mocked(useSecurityStatus);

type StatusReturn = ReturnType<typeof useSecurityStatus>;

beforeEach(() => {
  mockStatus.mockReset();
});

describe('SecurityCard', () => {
  it('reports encryption on', () => {
    mockStatus.mockReturnValue({
      data: { encryptionEnabled: true },
      isLoading: false,
      isError: false,
    } as StatusReturn);
    render(<SecurityCard />);
    expect(screen.getByTestId('security-encryption-status')).toHaveTextContent('On');
    expect(screen.getByText(/encrypted on disk/i)).toBeInTheDocument();
  });

  it('reports encryption off with enable instructions', () => {
    mockStatus.mockReturnValue({
      data: { encryptionEnabled: false },
      isLoading: false,
      isError: false,
    } as StatusReturn);
    render(<SecurityCard />);
    expect(screen.getByTestId('security-encryption-status')).toHaveTextContent('Off');
    expect(screen.getByText(/homestead key generate/i)).toBeInTheDocument();
  });

  it('shows an error state when the status fails to load', () => {
    mockStatus.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as StatusReturn);
    render(<SecurityCard />);
    expect(screen.getByTestId('security-status-error')).toBeInTheDocument();
    expect(screen.queryByTestId('security-encryption-status')).not.toBeInTheDocument();
  });
});
