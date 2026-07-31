/**
 * PermissionsHome: renders the groups + roles admin surface and drives the
 * create-group and add/remove-member flows. The permissions hooks are spied so
 * no real react-query/aepbase wiring is needed; the pure helpers
 * (`bareId`, `summarizeRoleGrants`) run for real.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import * as toast from '@rambleraptor/homestead-core/shared/components/ToastProvider';
import * as hooks from '../../hooks';
import { PermissionsHome } from '../PermissionsHome';

function query<T>(data: T) {
  return { data, isLoading: false } as unknown as ReturnType<typeof hooks.useGroups>;
}
function mutation(mutateAsync = vi.fn().mockResolvedValue(undefined)) {
  return { mutateAsync, isPending: false } as unknown as ReturnType<typeof hooks.useCreateGroup>;
}

const GROUPS = [
  { id: 'g-adults', name: 'Adults', description: 'Grown-ups' },
  { id: 'g-kids', name: 'Kids' },
];
const ROLES = [
  { id: 'admin', name: 'Admin', description: 'Full control', grants: [{ target_scope: 'all', capability: 'manage' as const }] },
  { id: 'guest', name: 'Guest', description: 'Nothing until shared', grants: [] },
];
const USERS = [
  { id: 'u1', display_name: 'Alice', email: 'alice@example.com' },
  { id: 'u2', display_name: 'Bob', email: 'bob@example.com' },
];

describe('PermissionsHome', () => {
  const createGroup = vi.fn().mockResolvedValue(undefined);
  const addMember = vi.fn().mockResolvedValue(undefined);
  const removeMember = vi.fn().mockResolvedValue(undefined);
  const createRole = vi.fn().mockResolvedValue(undefined);
  const updateRole = vi.fn().mockResolvedValue(undefined);
  const deleteRole = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.restoreAllMocks();
    [createGroup, addMember, removeMember, createRole, updateRole, deleteRole].forEach((m) =>
      m.mockClear(),
    );

    vi.spyOn(toast, 'useToast').mockReturnValue({
      showToast: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(),
    });

    vi.spyOn(hooks, 'useGroups').mockReturnValue(query(GROUPS));
    vi.spyOn(hooks, 'useRoles').mockReturnValue(query(ROLES));
    vi.spyOn(hooks, 'useAllUsers').mockReturnValue(query(USERS));
    vi.spyOn(hooks, 'useCreateGroup').mockReturnValue(mutation(createGroup));
    vi.spyOn(hooks, 'useAddGroupMember').mockReturnValue(mutation(addMember));
    vi.spyOn(hooks, 'useRemoveGroupMember').mockReturnValue(mutation(removeMember));
    vi.spyOn(hooks, 'useDeleteGroup').mockReturnValue(mutation());
    vi.spyOn(hooks, 'useCreateRole').mockReturnValue(mutation(createRole));
    vi.spyOn(hooks, 'useUpdateRole').mockReturnValue(mutation(updateRole));
    vi.spyOn(hooks, 'useDeleteRole').mockReturnValue(mutation(deleteRole));
    // Adults has one member (Alice, with the admin role); Kids has none.
    vi.spyOn(hooks, 'useGroupMemberships').mockImplementation((groupId: string) =>
      query(groupId === 'g-adults' ? [{ id: 'm1', user: 'users/u1', role: 'admin' }] : []),
    );
  });

  it('lists groups and roles (with a grant summary)', () => {
    render(<PermissionsHome />);
    expect(screen.getByText('Adults')).toBeInTheDocument();
    expect(screen.getByText('Kids')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    // summarizeRoleGrants ran for real:
    expect(screen.getByText('manage on everything')).toBeInTheDocument();
    expect(screen.getByText('No access')).toBeInTheDocument();
  });

  it('creates a group through the modal', async () => {
    render(<PermissionsHome />);
    fireEvent.click(screen.getByTestId('add-group-button'));
    fireEvent.change(screen.getByTestId('group-name-input'), { target: { value: 'Guests' } });
    fireEvent.click(screen.getByTestId('group-create-submit'));
    expect(createGroup).toHaveBeenCalledWith({ name: 'Guests', description: undefined });
  });

  it('expands a group, shows its members, and adds/removes one', async () => {
    render(<PermissionsHome />);

    // Expand Adults → its one member (Alice) shows, resolved from users/u1.
    fireEvent.click(screen.getByTestId('group-expand-g-adults'));
    const members = await screen.findByTestId('group-members-g-adults');
    expect(within(members).getByText('Alice')).toBeInTheDocument();

    // Add Bob to Adults.
    fireEvent.change(screen.getByTestId('add-member-user-g-adults'), { target: { value: 'u2' } });
    fireEvent.click(screen.getByTestId('add-member-submit-g-adults'));
    expect(addMember).toHaveBeenCalledWith({ groupId: 'g-adults', userId: 'u2', role: '' });

    // Remove the existing membership.
    fireEvent.click(screen.getByTestId('remove-member-m1'));
    expect(removeMember).toHaveBeenCalledWith({ groupId: 'g-adults', membershipId: 'm1' });
  });

  it('creates a role with a grant through the editor', async () => {
    render(<PermissionsHome />);
    fireEvent.click(screen.getByTestId('add-role-button'));
    fireEvent.change(screen.getByTestId('role-name-input'), { target: { value: 'Cook' } });

    // Add a grant and make it "manage on everything".
    fireEvent.click(screen.getByTestId('role-add-grant'));
    fireEvent.change(screen.getByLabelText('capability'), { target: { value: 'manage' } });
    fireEvent.change(screen.getByLabelText('scope'), { target: { value: 'all' } });

    fireEvent.click(screen.getByTestId('role-submit'));
    expect(createRole).toHaveBeenCalledWith({
      name: 'Cook',
      description: undefined,
      grants: [{ target_scope: 'all', capability: 'manage' }],
    });
  });

  it('edits an existing role (pre-filled) and saves', () => {
    render(<PermissionsHome />);
    fireEvent.click(screen.getByTestId('edit-role-admin'));
    const nameInput = screen.getByTestId('role-name-input') as HTMLInputElement;
    expect(nameInput.value).toBe('Admin'); // pre-filled from the record
    fireEvent.change(nameInput, { target: { value: 'Administrator' } });
    fireEvent.click(screen.getByTestId('role-submit'));
    expect(updateRole).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'admin', name: 'Administrator' }),
    );
  });

  it('deletes a role after confirmation', () => {
    render(<PermissionsHome />);
    fireEvent.click(screen.getByTestId('delete-role-guest'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(deleteRole).toHaveBeenCalledWith('guest');
  });
});
