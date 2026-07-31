/**
 * `<PermissionGate>` renders its children when `can(verb, resourceType)` is
 * true and redirects to the fallback otherwise. The resolving lives in
 * `useCan`; the gate just wires it to a redirect.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PermissionGate } from '../PermissionGate';
import { useAuth } from '@rambleraptor/homestead-core/auth/useAuth';
import { useCan } from '@rambleraptor/homestead-core/permissions/useCan';
import type { User } from '@rambleraptor/homestead-core/auth/types';

const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));
vi.mock('@rambleraptor/homestead-core/auth/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('@rambleraptor/homestead-core/permissions/useCan', () => ({ useCan: vi.fn() }));

const user: User = {
  id: 'u1',
  email: 'u1@example.com',
  username: 'u1@example.com',
  name: 'U1',
  verified: true,
  created: '2024-01-01',
  updated: '2024-01-01',
  type: 'regular',
};

function mockAuth(u: User | null, isLoading = false) {
  vi.mocked(useAuth).mockReturnValue({
    user: u,
    token: u ? 't' : null,
    isAuthenticated: u !== null,
    isLoading,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>);
}

function mockCan(allowed: boolean) {
  vi.mocked(useCan).mockReturnValue(() => allowed);
}

describe('PermissionGate', () => {
  beforeEach(() => {
    navigate.mockClear();
  });

  it('renders children when the capability is allowed', () => {
    mockAuth(user);
    mockCan(true);
    render(
      <PermissionGate verb="write" resourceType="recipe">
        <div>gated content</div>
      </PermissionGate>,
    );
    expect(screen.getByText('gated content')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('redirects and hides children when denied', async () => {
    mockAuth(user);
    mockCan(false);
    render(
      <PermissionGate verb="write" resourceType="recipe">
        <div>gated content</div>
      </PermissionGate>,
    );
    expect(screen.queryByText('gated content')).not.toBeInTheDocument();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/dashboard', { replace: true }));
  });
});
