/**
 * Tests for the Login page: OAuth provider buttons and the first-visit
 * (instance-claim) setup flow.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

describe('Login first-visit setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(aepbase.listOAuthProviders).mockResolvedValue([]);
    // The instance reports it still needs its admin account claimed.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/setup')) {
          return new Response(JSON.stringify({ needsSetup: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('null', { status: 200 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the welcome intro before the create-admin form', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    // Intro appears first — explaining Homestead, no account fields yet.
    const intro = await screen.findByTestId('setup-intro');
    expect(intro).toHaveTextContent(/homestead is your household/i);
    expect(screen.queryByLabelText(/email/i)).toBeNull();
    expect(screen.queryByTestId('setup-confirm-password')).toBeNull();
  });

  it('reveals the create-admin form after "Get started"', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    await userEvent.click(await screen.findByTestId('setup-get-started'));

    // The intro is replaced by the claim form (email + password + confirm).
    expect(screen.queryByTestId('setup-intro')).toBeNull();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByTestId('setup-confirm-password')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /create admin account/i }),
    ).toBeInTheDocument();
  });
});
