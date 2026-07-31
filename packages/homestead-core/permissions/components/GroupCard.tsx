import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Trash2, UserPlus, Users, X } from 'lucide-react';
import { Card } from '@rambleraptor/homestead-core/shared/components/Card';
import { Button } from '@rambleraptor/homestead-core/shared/components/Button';
import { Badge } from '@rambleraptor/homestead-core/shared/components/Badge';
import { Spinner } from '@rambleraptor/homestead-core/shared/components/Spinner';
import { ConfirmDialog } from '@rambleraptor/homestead-core/shared/components/ConfirmDialog';
import { useToast } from '@rambleraptor/homestead-core/shared/components/ToastProvider';
import {
  bareId,
  useAddGroupMember,
  useDeleteGroup,
  useGroupMemberships,
  useRemoveGroupMember,
  type GroupRecord,
  type RoleRecord,
  type UserLite,
} from '../hooks';

interface Props {
  group: GroupRecord;
  users: UserLite[];
  roles: RoleRecord[];
}

function userLabel(users: UserLite[], userRef: string): string {
  const id = bareId(userRef);
  const u = users.find((x) => x.id === id);
  return u?.display_name || u?.email || id;
}

/**
 * One group: name/description, a member count, and an expandable panel to add or
 * remove members (with an optional role). Deleting the group removes its
 * memberships first (see `useDeleteGroup`).
 */
export function GroupCard({ group, users, roles }: Props) {
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pickUser, setPickUser] = useState('');
  const [pickRole, setPickRole] = useState('');

  const { data: members, isLoading } = useGroupMemberships(expanded ? group.id : '');
  const addMember = useAddGroupMember();
  const removeMember = useRemoveGroupMember();
  const deleteGroup = useDeleteGroup();

  const memberUserIds = useMemo(
    () => new Set((members ?? []).map((m) => bareId(m.user))),
    [members],
  );
  const addableUsers = users.filter((u) => !memberUserIds.has(u.id));

  const handleAdd = async () => {
    if (!pickUser) return;
    try {
      await addMember.mutateAsync({ groupId: group.id, userId: pickUser, role: pickRole });
      setPickUser('');
      setPickRole('');
      toast.success('Member added');
    } catch {
      // Global mutation error toast (queryClient.ts) surfaces the reason.
    }
  };

  const handleRemove = async (membershipId: string) => {
    try {
      await removeMember.mutateAsync({ groupId: group.id, membershipId });
      toast.success('Member removed');
    } catch {
      /* surfaced globally */
    }
  };

  const handleDelete = async () => {
    try {
      await deleteGroup.mutateAsync(group.id);
      setConfirmDelete(false);
      toast.success('Group deleted');
    } catch {
      /* surfaced globally */
    }
  };

  return (
    <Card data-testid={`group-card-${group.id}`}>
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          className="flex items-center gap-3 min-w-0 text-left"
          onClick={() => setExpanded((e) => !e)}
          data-testid={`group-expand-${group.id}`}
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
          <Users className="w-5 h-5 text-gray-500 flex-shrink-0" />
          <div className="min-w-0">
            <span className="font-medium text-gray-900 truncate">{group.name}</span>
            {group.description && (
              <p className="text-sm text-gray-600 truncate">{group.description}</p>
            )}
          </div>
        </button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => setConfirmDelete(true)}
          title="Delete group"
          data-testid={`delete-group-${group.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {expanded && (
        <div className="mt-4 border-t border-gray-100 pt-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Spinner size="sm" />
            </div>
          ) : (
            <>
              {members && members.length > 0 ? (
                <ul className="space-y-2" data-testid={`group-members-${group.id}`}>
                  {members.map((m) => {
                    const roleName = m.role
                      ? roles.find((r) => r.id === bareId(m.role!))?.name
                      : undefined;
                    return (
                      <li
                        key={m.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="truncate text-gray-900">
                            {userLabel(users, m.user)}
                          </span>
                          {roleName && <Badge variant="info">{roleName}</Badge>}
                        </span>
                        <button
                          type="button"
                          className="text-gray-400 hover:text-red-600"
                          onClick={() => handleRemove(m.id)}
                          title="Remove member"
                          data-testid={`remove-member-${m.id}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No members yet.</p>
              )}

              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col text-xs text-gray-600">
                  Add member
                  <select
                    className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    value={pickUser}
                    onChange={(e) => setPickUser(e.target.value)}
                    data-testid={`add-member-user-${group.id}`}
                  >
                    <option value="">Select a user…</option>
                    {addableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.display_name || u.email || u.id}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col text-xs text-gray-600">
                  Role (optional)
                  <select
                    className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    value={pickRole}
                    onChange={(e) => setPickRole(e.target.value)}
                    data-testid={`add-member-role-${group.id}`}
                  >
                    <option value="">No role</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  size="sm"
                  onClick={handleAdd}
                  disabled={!pickUser || addMember.isPending}
                  data-testid={`add-member-submit-${group.id}`}
                >
                  <UserPlus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete group"
        message={`Delete "${group.name}"? Its memberships are removed, and any app or grant that targets this group stops applying. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteGroup.isPending}
      />
    </Card>
  );
}
