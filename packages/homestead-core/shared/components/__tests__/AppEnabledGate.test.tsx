/**
 * Tests for the page-level `<AppEnabledGate>` that hides an app's
 * content from disallowed viewers and redirects them to a fallback.
 * The hard work of resolving visibility lives in `useAppFlag` +
 * `useAuth`; the gate just wires those together with a redirect.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AppEnabledGate } from '../AppEnabledGate';
import { useAuth } from '@rambleraptor/homestead-core/auth/useAuth';
import { useAppFlag } from '@rambleraptor/homestead-core/settings/hooks/useAppFlag';
import type { User } from '@rambleraptor/homestead-core/auth/types';

const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

vi.mock('@rambleraptor/homestead-core/auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@rambleraptor/homestead-core/settings/hooks/useAppFlag', () => ({
  useAppFlag: vi.fn(),
}));

const mockUser = (type: 'superuser' | 'regular'): User => ({
  id: 'u1',
  email: 'u1@example.com',
  username: 'u1@example.com',
  name: 'U1',
  verified: true,
  created: '2024-01-01',
  updated: '2024-01-01',
  type,
});

const mockAuth = (user: User | null, isLoading = false) => {
  vi.mocked(useAuth).mockReturnValue({
    user,
    token: user ? 't' : null,
    isAuthenticated: user !== null,
    isLoading,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  });
};

const mockFlag = (value: string | undefined, isLoading = false) => {
  vi.mocked(useAppFlag).mockReturnValue({
    value,
    setValue: vi.fn(),
    isLoading,
    isSaving: false,
    error: null,
  });
};

describe('AppEnabledGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the children when the viewer passes the enabled flag', () => {
    mockAuth(mockUser('regular'));
    mockFlag('all');

    render(
      <AppEnabledGate appId="minigolf">
        <div>protected</div>
      </AppEnabledGate>,
    );

    expect(screen.getByText('protected')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("redirects regular users away from a 'superusers' app", async () => {
    mockAuth(mockUser('regular'));
    mockFlag('superusers');

    render(
      <AppEnabledGate appId="users">
        <div>protected</div>
      </AppEnabledGate>,
    );

    expect(screen.queryByText('protected')).not.toBeInTheDocument();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/dashboard', { replace: true }));
  });

  it("redirects everyone (even superusers) away from a 'none' app", async () => {
    mockAuth(mockUser('superuser'));
    mockFlag('none');

    render(
      <AppEnabledGate appId="bridge">
        <div>protected</div>
      </AppEnabledGate>,
    );

    expect(screen.queryByText('protected')).not.toBeInTheDocument();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/dashboard', { replace: true }));
  });

  it('does not redirect while auth or flags are still loading', () => {
    mockAuth(null, true);
    mockFlag('all', true);

    render(
      <AppEnabledGate appId="minigolf">
        <div>protected</div>
      </AppEnabledGate>,
    );

    expect(navigate).not.toHaveBeenCalled();
    expect(screen.queryByText('protected')).not.toBeInTheDocument();
  });

  it('honors a custom fallback path', async () => {
    mockAuth(mockUser('regular'));
    mockFlag('none');

    render(
      <AppEnabledGate appId="bridge" fallbackPath="/games">
        <div>protected</div>
      </AppEnabledGate>,
    );

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/games', { replace: true }));
  });
});
