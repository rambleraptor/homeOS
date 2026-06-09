/**
 * Tests for the shared `useIsAppEnabled` gate that reads the built-in
 * `enabled` flag for a given app and combines it with the current
 * user's role.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIsAppEnabled } from '../hooks/useIsAppEnabled';
import { useAppFlag } from '../hooks/useAppFlag';
import { useAuth } from '@rambleraptor/homestead-core/auth/useAuth';
import { BUILTIN_ENABLED_TAGS_FLAG_KEY } from '../visibility';
import type { User } from '@rambleraptor/homestead-core/auth/types';

vi.mock('@rambleraptor/homestead-core/auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../hooks/useAppFlag', () => ({
  useAppFlag: vi.fn(),
}));

const mockUser = (
  type: 'superuser' | 'regular',
  tags?: string[],
): User => ({
  id: 'u1',
  email: 'u1@example.com',
  username: 'u1@example.com',
  name: 'U1',
  verified: true,
  created: '2024-01-01',
  updated: '2024-01-01',
  type,
  tags,
});

/**
 * Configure the mocked `useAppFlag` to return the visibility on the
 * first call and the tag list on the second. Matches the call order in
 * `useIsAppEnabled`.
 */
const mockFlags = (visibility: string | undefined, tags?: string) => {
  vi.mocked(useAppFlag).mockImplementation((_appId: string, key: string) => {
    const value = key === BUILTIN_ENABLED_TAGS_FLAG_KEY ? tags : visibility;
    return {
      value,
      setValue: vi.fn(),
      isLoading: false,
      isSaving: false,
      error: null,
    } as ReturnType<typeof useAppFlag>;
  });
};

const mockAuth = (user: User | null) => {
  vi.mocked(useAuth).mockReturnValue({
    user,
    token: user ? 't' : null,
    isAuthenticated: user !== null,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  });
};

describe('useIsAppEnabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false for 'none' even for superusers", () => {
    mockAuth(mockUser('superuser'));
    mockFlags('none');
    const { result } = renderHook(() => useIsAppEnabled('recipes'));
    expect(result.current).toBe(false);
  });

  it("returns true for 'all' for any signed-in user", () => {
    mockAuth(mockUser('regular'));
    mockFlags('all');
    const { result } = renderHook(() => useIsAppEnabled('recipes'));
    expect(result.current).toBe(true);
  });

  it("returns false for 'all' when signed out", () => {
    mockAuth(null);
    mockFlags('all');
    const { result } = renderHook(() => useIsAppEnabled('recipes'));
    expect(result.current).toBe(false);
  });

  it("returns true for 'superusers' only for superusers", () => {
    mockAuth(mockUser('superuser'));
    mockFlags('superusers');
    const { result: superuser } = renderHook(() =>
      useIsAppEnabled('recipes'),
    );
    expect(superuser.current).toBe(true);

    mockAuth(mockUser('regular'));
    const { result: regular } = renderHook(() =>
      useIsAppEnabled('recipes'),
    );
    expect(regular.current).toBe(false);
  });

  it("falls back to the default 'all' when the flag is undefined", () => {
    mockAuth(mockUser('regular'));
    mockFlags(undefined);
    const { result } = renderHook(() => useIsAppEnabled('recipes'));
    expect(result.current).toBe(true);
  });

  describe("when 'tagged'", () => {
    it('returns true when the user has at least one matching tag', () => {
      mockAuth(mockUser('regular', ['beta', 'kitchen']));
      mockFlags('tagged', 'beta,early-access');
      const { result } = renderHook(() => useIsAppEnabled('recipes'));
      expect(result.current).toBe(true);
    });

    it('returns false when the user has no matching tag', () => {
      mockAuth(mockUser('regular', ['kitchen']));
      mockFlags('tagged', 'beta,early-access');
      const { result } = renderHook(() => useIsAppEnabled('recipes'));
      expect(result.current).toBe(false);
    });

    it('returns false when the user has no tags at all', () => {
      mockAuth(mockUser('regular'));
      mockFlags('tagged', 'beta');
      const { result } = renderHook(() => useIsAppEnabled('recipes'));
      expect(result.current).toBe(false);
    });

    it('returns false when the allowed-tags list is empty', () => {
      mockAuth(mockUser('regular', ['beta']));
      mockFlags('tagged', '');
      const { result } = renderHook(() => useIsAppEnabled('recipes'));
      expect(result.current).toBe(false);
    });

    it('does NOT auto-bypass for superusers without a matching tag', () => {
      mockAuth(mockUser('superuser', ['admin']));
      mockFlags('tagged', 'beta');
      const { result } = renderHook(() => useIsAppEnabled('recipes'));
      expect(result.current).toBe(false);
    });

    it('ignores whitespace and duplicates in the tag list', () => {
      mockAuth(mockUser('regular', ['beta']));
      mockFlags('tagged', ' beta , beta , ');
      const { result } = renderHook(() => useIsAppEnabled('recipes'));
      expect(result.current).toBe(true);
    });
  });
});
