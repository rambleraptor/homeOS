/**
 * React-query hooks for the permissions data model (design §15) — the data
 * layer under any admin/sharing UI. Roles, groups, and access-grants are
 * ordinary AEP resources, so these are thin wrappers over the aepbase client;
 * the server enforces the manage-on-target write rule (§15.3), so a failed
 * mutation surfaces as an error, not a silent no-op.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { aepbase } from '../api/aepbase';
import { ACCESS_GRANTS, GROUP_MEMBERSHIPS, GROUPS, ROLES } from './resources';
import type { Capability } from './resolve';

// ─────────────────────────── Record shapes ───────────────────────────

export interface RoleGrantRow {
  target_scope?: string;
  target_app?: string;
  resource_type?: string;
  filter?: string;
  capability?: Capability;
}
export interface RoleRecord {
  id: string;
  name: string;
  description?: string;
  grants?: RoleGrantRow[];
}
export interface GroupRecord {
  id: string;
  name: string;
  description?: string;
}
export interface GroupMembershipRecord {
  id: string;
  user: string;
  role?: string;
}
export interface AccessGrantRecord {
  id: string;
  subject_type: 'user' | 'group' | 'everyone';
  subject_id?: string;
  target_scope: 'all' | 'app' | 'collection' | 'record';
  target_app?: string;
  resource_type?: string;
  resource_id?: string;
  filter?: string;
  capability: Capability;
  effect?: 'allow' | 'deny';
}

const keys = {
  roles: ['permissions', 'roles'] as const,
  groups: ['permissions', 'groups'] as const,
  members: (groupId: string) => ['permissions', 'groups', groupId, 'members'] as const,
  grants: (filter: string) => ['permissions', 'access-grants', filter] as const,
  grantsAll: ['permissions', 'access-grants'] as const,
};

// ─────────────────────────── Queries ───────────────────────────

export function useRoles() {
  return useQuery({ queryKey: keys.roles, queryFn: () => aepbase.list<RoleRecord>(ROLES) });
}

export function useGroups() {
  return useQuery({ queryKey: keys.groups, queryFn: () => aepbase.list<GroupRecord>(GROUPS) });
}

export function useGroupMemberships(groupId: string) {
  return useQuery({
    queryKey: keys.members(groupId),
    queryFn: () => aepbase.list<GroupMembershipRecord>(GROUP_MEMBERSHIPS, { parent: [GROUPS, groupId] }),
    enabled: !!groupId,
  });
}

/** Grants, optionally scoped to a single record ("who can see this?"). */
export function useAccessGrants(target?: { resourceType?: string; recordId?: string }) {
  const clauses: string[] = [];
  if (target?.resourceType) clauses.push(`resource_type == '${target.resourceType}'`);
  if (target?.recordId) clauses.push(`resource_id == '${target.recordId}'`);
  const filter = clauses.join(' && ');
  return useQuery({
    queryKey: filter ? keys.grants(filter) : keys.grantsAll,
    queryFn: () => aepbase.list<AccessGrantRecord>(ACCESS_GRANTS, filter ? { filter } : {}),
  });
}

// ─────────────────────────── Mutations ───────────────────────────

export interface ShareRecordInput {
  resourceType: string;
  recordId: string;
  subject: { type: 'user' | 'group'; id: string };
  capability?: Capability; // default 'read'
}

/** Share a single record with a user or group (record-scope grant). */
export function useShareRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ShareRecordInput) =>
      aepbase.create<AccessGrantRecord>(ACCESS_GRANTS, {
        subject_type: input.subject.type,
        subject_id: input.subject.id,
        target_scope: 'record',
        resource_type: input.resourceType,
        resource_id: input.recordId,
        capability: input.capability ?? 'read',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.grantsAll }),
  });
}

/** Revoke any grant by id (un-share). */
export function useRevokeGrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (grantId: string) => aepbase.remove(ACCESS_GRANTS, grantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.grantsAll }),
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      aepbase.create<GroupRecord>(GROUPS, { name: data.name, description: data.description }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.groups }),
  });
}

export interface AddGroupMemberInput {
  groupId: string;
  userId: string;
  role?: string;
}

export function useAddGroupMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddGroupMemberInput) =>
      aepbase.create<GroupMembershipRecord>(
        GROUP_MEMBERSHIPS,
        { user: input.userId, role: input.role },
        { parent: [GROUPS, input.groupId] },
      ),
    onSuccess: (_data, input) => qc.invalidateQueries({ queryKey: keys.members(input.groupId) }),
  });
}
