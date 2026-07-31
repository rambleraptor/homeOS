/**
 * The permissions data-layer hooks call the aepbase client with the right
 * collection, body, and filter. The server enforces authorization; these just
 * shape the requests.
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { ACCESS_GRANTS, GROUPS, GROUP_MEMBERSHIPS } from '../resources';
import {
  useAccessGrants,
  useAddGroupMember,
  useGroups,
  useRevokeGrant,
  useRoles,
  useShareRecord,
} from '../hooks';

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(aepbase.list).mockResolvedValue([]);
  vi.mocked(aepbase.create).mockResolvedValue({ id: 'new' } as never);
  vi.mocked(aepbase.remove).mockResolvedValue(undefined as never);
});

describe('permission data hooks', () => {
  it('useRoles / useGroups list their collections', async () => {
    const roles = renderHook(() => useRoles(), { wrapper: createWrapper() });
    await waitFor(() => expect(roles.result.current.isSuccess).toBe(true));
    expect(aepbase.list).toHaveBeenCalledWith('roles');

    const groups = renderHook(() => useGroups(), { wrapper: createWrapper() });
    await waitFor(() => expect(groups.result.current.isSuccess).toBe(true));
    expect(aepbase.list).toHaveBeenCalledWith(GROUPS);
  });

  it('useAccessGrants builds a record-scoped filter', async () => {
    const { result } = renderHook(
      () => useAccessGrants({ resourceType: 'recipe', recordId: 'r1' }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(aepbase.list).toHaveBeenCalledWith(ACCESS_GRANTS, {
      filter: "resource_type == 'recipe' && resource_id == 'r1'",
    });
  });

  it('useShareRecord creates a record-scope grant', async () => {
    const { result } = renderHook(() => useShareRecord(), { wrapper: createWrapper() });
    await result.current.mutateAsync({
      resourceType: 'recipe',
      recordId: 'r1',
      subject: { type: 'user', id: 'bob' },
    });
    expect(aepbase.create).toHaveBeenCalledWith(ACCESS_GRANTS, {
      subject_type: 'user',
      subject_id: 'bob',
      target_scope: 'record',
      resource_type: 'recipe',
      resource_id: 'r1',
      capability: 'read',
    });
  });

  it('useRevokeGrant removes a grant', async () => {
    const { result } = renderHook(() => useRevokeGrant(), { wrapper: createWrapper() });
    await result.current.mutateAsync('g1');
    expect(aepbase.remove).toHaveBeenCalledWith(ACCESS_GRANTS, 'g1');
  });

  it('useAddGroupMember creates a membership under the group', async () => {
    const { result } = renderHook(() => useAddGroupMember(), { wrapper: createWrapper() });
    await result.current.mutateAsync({ groupId: 'g1', userId: 'bob', role: 'member' });
    expect(aepbase.create).toHaveBeenCalledWith(
      GROUP_MEMBERSHIPS,
      { user: 'bob', role: 'member' },
      { parent: [GROUPS, 'g1'] },
    );
  });
});
