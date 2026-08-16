/**
 * Tests for the useChangePassword hook.
 *
 * The hook delegates to `aepbase.changePassword`, which posts to
 * `/api/auth/change-password`. The server owns verifying the current password
 * and rotating the session; the hook's own job is the confirm-match check and
 * surfacing errors, which is what these cover.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useChangePassword } from '../hooks/useChangePassword';
import type { ChangePasswordData } from '../hooks/useChangePassword';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useChangePassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(aepbase.changePassword).mockResolvedValue(undefined);
  });

  it('sends the current and new password to the auth service', async () => {
    const passwordData: ChangePasswordData = {
      oldPassword: 'oldpassword123',
      password: 'newpassword123',
      passwordConfirm: 'newpassword123',
    };

    const { result } = renderHook(() => useChangePassword(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(passwordData);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(aepbase.changePassword).toHaveBeenCalledWith('oldpassword123', 'newpassword123');
  });

  it('never sends the request when new password and confirm do not match', async () => {
    const { result } = renderHook(() => useChangePassword(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      oldPassword: 'oldpassword123',
      password: 'a-new-password',
      passwordConfirm: 'a-different-one',
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(aepbase.changePassword).not.toHaveBeenCalled();
  });

  it('propagates the server error when the current password is wrong', async () => {
    const error = new Error('current password is incorrect');
    vi.mocked(aepbase.changePassword).mockRejectedValueOnce(error);

    const { result } = renderHook(() => useChangePassword(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      oldPassword: 'wrong',
      password: 'newpassword123',
      passwordConfirm: 'newpassword123',
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toEqual(error);
  });

  it('propagates a server-side policy rejection', async () => {
    const error = new Error('password must be at least 8 characters');
    vi.mocked(aepbase.changePassword).mockRejectedValueOnce(error);

    const { result } = renderHook(() => useChangePassword(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      oldPassword: 'oldpassword123',
      password: 'sh0rt',
      passwordConfirm: 'sh0rt',
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toEqual(error);
  });

  it('sets isPending during the mutation', async () => {
    let resolveChange: (v: undefined) => void;
    const pending = new Promise<undefined>((r) => {
      resolveChange = r;
    });
    vi.mocked(aepbase.changePassword).mockReturnValueOnce(pending as Promise<void>);

    const { result } = renderHook(() => useChangePassword(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(false);
    result.current.mutate({
      oldPassword: 'oldpassword123',
      password: 'newpassword123',
      passwordConfirm: 'newpassword123',
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    resolveChange!(undefined);

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
  });
});
