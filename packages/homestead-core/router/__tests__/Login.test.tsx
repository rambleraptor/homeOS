/**
 * Tests for the OAuth provider buttons on the Login page.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Login } from '../Login';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';

vi.mock('@rambleraptor/homestead-core/auth/useAuth', () => ({
  useAuth: () => ({ login: vi.fn(), isAuthenticated: false, isLoading: false }),
}));

describe('Login OAuth providers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a button per configured provider and starts OAuth on click', async () => {
    vi.mocked(aepbase.listOAuthProviders).mockResolvedValue([
      { name: 'google', display_name: 'Google' },
    ]);

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    const button = await screen.findByTestId('oauth-google');
    expect(button).toHaveTextContent('Sign in with Google');

    await userEvent.click(button);
    expect(aepbase.startOAuth).toHaveBeenCalledWith('google');
  });

  it('shows no provider section when none are configured', async () => {
    vi.mocked(aepbase.listOAuthProviders).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    await waitFor(() => expect(aepbase.listOAuthProviders).toHaveBeenCalled());
    expect(screen.queryByTestId('oauth-providers')).toBeNull();
  });
});
