import { useState } from 'react';
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { Card } from '@rambleraptor/homestead-core/shared/components/Card';
import { Button } from '@rambleraptor/homestead-core/shared/components/Button';
import { Badge } from '@rambleraptor/homestead-core/shared/components/Badge';
import { Input } from '@rambleraptor/homestead-core/shared/components/Input';
import { Modal } from '@rambleraptor/homestead-core/shared/components/Modal';
import { Spinner } from '@rambleraptor/homestead-core/shared/components/Spinner';
import { ConfirmDialog } from '@rambleraptor/homestead-core/shared/components/ConfirmDialog';
import { PageHeader } from '@rambleraptor/homestead-core/shared/components/PageHeader';
import { useToast } from '@rambleraptor/homestead-core/shared/components/ToastProvider';
import {
  summarizeRoleGrants,
  useAllUsers,
  useCreateGroup,
  useCreateRole,
  useDeleteRole,
  useGroups,
  useRoles,
  useUpdateRole,
  type RoleInput,
  type RoleRecord,
} from '../hooks';
import { GroupCard } from './GroupCard';
import { RoleForm } from './RoleForm';

/**
 * Superuser page to manage the permissions data model: **groups** (create,
 * delete, and manage membership) and a read-only view of the built-in **roles**.
 *
 * Groups are the "set of people" primitive used by both app-access gating
 * (`tagged` audience, §9.2) and access-grants, so this is the main knob an admin
 * turns. Roles are seeded (admin/member/guest) and shown for reference; editing
 * their grants is a later increment.
 */
export function PermissionsHome() {
  const toast = useToast();
  const { data: groups, isLoading: groupsLoading } = useGroups();
  const { data: roles, isLoading: rolesLoading } = useRoles();
  const { data: users } = useAllUsers();
  const createGroup = useCreateGroup();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Role editor: `null` closed, `{}` create, a record edit; plus a delete target.
  const [roleModal, setRoleModal] = useState<RoleRecord | 'new' | null>(null);
  const [roleDeleteTarget, setRoleDeleteTarget] = useState<RoleRecord | null>(null);

  const handleRoleSubmit = async (data: RoleInput) => {
    try {
      if (roleModal && roleModal !== 'new') {
        await updateRole.mutateAsync({ id: roleModal.id, ...data });
        toast.success('Role updated');
      } else {
        await createRole.mutateAsync(data);
        toast.success('Role created');
      }
      setRoleModal(null);
    } catch {
      // Global mutation error toast (queryClient.ts) surfaces the reason.
    }
  };

  const handleRoleDelete = async () => {
    if (!roleDeleteTarget) return;
    try {
      await deleteRole.mutateAsync(roleDeleteTarget.id);
      setRoleDeleteTarget(null);
      toast.success('Role deleted');
    } catch {
      /* surfaced globally */
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      await createGroup.mutateAsync({ name: name.trim(), description: description.trim() || undefined });
      setName('');
      setDescription('');
      setIsCreateOpen(false);
      toast.success('Group created');
    } catch {
      // Global mutation error toast (queryClient.ts) surfaces the reason.
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Permissions"
        subtitle="Manage groups and view the roles that grant access across the household."
      />

      {/* ── Groups ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Groups</h2>
          <Button onClick={() => setIsCreateOpen(true)} data-testid="add-group-button">
            <Plus className="w-4 h-4 mr-2" />
            New group
          </Button>
        </div>

        {groupsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : !groups || groups.length === 0 ? (
          <Card>
            <p className="text-center text-gray-600 py-8">
              No groups yet. Create one to gate an app to a set of people, or to share
              data with them.
            </p>
          </Card>
        ) : (
          <div className="space-y-3" data-testid="groups-list">
            {groups.map((g) => (
              <GroupCard key={g.id} group={g} users={users ?? []} roles={roles ?? []} />
            ))}
          </div>
        )}
      </section>

      {/* ── Roles ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Roles</h2>
          <Button onClick={() => setRoleModal('new')} data-testid="add-role-button">
            <Plus className="w-4 h-4 mr-2" />
            New role
          </Button>
        </div>
        <p className="text-sm text-gray-600">
          A role is a bundle of access conferred on a group member. Assign one when
          adding someone to a group.
        </p>
        {rolesLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : !roles || roles.length === 0 ? (
          <Card>
            <p className="text-center text-gray-600 py-8">No roles defined.</p>
          </Card>
        ) : (
          <div className="space-y-3" data-testid="roles-list">
            {roles.map((r) => (
              <Card key={r.id} data-testid={`role-card-${r.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <ShieldCheck className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{r.name}</span>
                        <Badge variant="info">{summarizeRoleGrants(r.grants)}</Badge>
                      </div>
                      {r.description && (
                        <p className="text-sm text-gray-600 mt-0.5">{r.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setRoleModal(r)}
                      title="Edit role"
                      data-testid={`edit-role-${r.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setRoleDeleteTarget(r)}
                      title="Delete role"
                      data-testid={`delete-role-${r.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="New group">
        <div className="space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Adults, Kids, Guests"
            data-testid="group-name-input"
            autoFocus
          />
          <Input
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this group for?"
            data-testid="group-description-input"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || createGroup.isPending}
              data-testid="group-create-submit"
            >
              Create
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={roleModal !== null}
        onClose={() => setRoleModal(null)}
        title={roleModal && roleModal !== 'new' ? 'Edit role' : 'New role'}
      >
        {roleModal !== null && (
          <RoleForm
            initialRole={roleModal === 'new' ? undefined : roleModal}
            onSubmit={handleRoleSubmit}
            onCancel={() => setRoleModal(null)}
            isSubmitting={createRole.isPending || updateRole.isPending}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!roleDeleteTarget}
        onClose={() => setRoleDeleteTarget(null)}
        onConfirm={handleRoleDelete}
        title="Delete role"
        message={`Delete the "${roleDeleteTarget?.name}" role? Members who were assigned it stop receiving its access. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteRole.isPending}
      />
    </div>
  );
}
