/**
 * The create-user form's "Access level" picker. A user gets a role by joining a
 * role-bearing group, so the picker lists those groups, defaults a new regular
 * user to the Member level, hides for superusers, and passes the chosen group
 * back to the caller (which turns it into a group membership).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as permHooks from '@rambleraptor/homestead-core/permissions/hooks';
import * as registry from '@rambleraptor/homestead-core/apps/registry';
import * as authHook from '@rambleraptor/homestead-core/auth/useAuth';
import { UserForm } from '../UserForm';

const GROUPS = [
  { id: 'guests', name: 'Guests', role: 'guest' },
  { id: 'admins', name: 'Admins', role: 'admin' },
  { id: 'members', name: 'Members', role: 'member' },
  { id: 'no-role', name: 'Book Club' }, // role-less: not an access level
];

const ROLES = [
  { id: 'admin', name: 'Admin', grants: [{ target_scope: 'all', capability: 'manage' }] },
  { id: 'member', name: 'Member', grants: [{ target_scope: 'all', capability: 'write' }] },
  { id: 'guest', name: 'Guest', grants: [] },
];

function mockHooks({ groups = GROUPS, roles = ROLES } = {}) {
  vi.spyOn(permHooks, 'useGroups').mockReturnValue({ data: groups } as never);
  vi.spyOn(permHooks, 'useRoles').mockReturnValue({ data: roles } as never);
  // Deps of the NewUserAccessPreview fallback (rendered for superusers, or when
  // there are no role-bearing groups to pick from).
  vi.spyOn(permHooks, 'useAccessGrants').mockReturnValue({ data: [] } as never);
  vi.spyOn(registry, 'getNavigationApps').mockReturnValue([] as never);
  vi.spyOn(authHook, 'useAuth').mockReturnValue({
    user: { permissions: { enforced: true } },
  } as never);
}

describe('UserForm access-level picker', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('lists role-bearing groups (admin/member/guest order), defaulting to Member', async () => {
    mockHooks();
    render(<UserForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    const select = (await screen.findByTestId('user-access-level-select')) as HTMLSelectElement;
    const optionLabels = Array.from(select.options).map((o) => o.textContent);
    // Built-in roles ordered first; the role-less group is excluded.
    expect(optionLabels).toEqual(['Admins', 'Members', 'Guests']);
    await waitFor(() => expect(select.value).toBe('members'));
    expect(screen.getByTestId('user-access-level-summary').textContent).toMatch(
      /write on everything/i,
    );
  });

  it('passes the chosen group as groupId on submit', async () => {
    mockHooks();
    const onSubmit = vi.fn();
    render(<UserForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    fireEvent.change(await screen.findByTestId('user-email-input'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByTestId('user-password-input'), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByTestId('user-access-level-select'), {
      target: { value: 'admins' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create user/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com', type: 'regular', groupId: 'admins' }),
    );
  });

  it('hides the picker for superusers and sends no groupId', async () => {
    mockHooks();
    const onSubmit = vi.fn();
    render(<UserForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    fireEvent.change(await screen.findByTestId('user-email-input'), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.change(screen.getByTestId('user-password-input'), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByTestId('user-type-select'), { target: { value: 'superuser' } });
    expect(screen.queryByTestId('user-access-level-select')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /create user/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'superuser', groupId: undefined }),
    );
  });

  it('falls back to the open-household preview when no role-bearing groups exist', async () => {
    mockHooks({ groups: [{ id: 'no-role', name: 'Book Club' }] });
    render(<UserForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByTestId('user-access-level-select')).not.toBeInTheDocument();
    expect(screen.getByTestId('new-user-access-preview')).toBeInTheDocument();
  });
});
