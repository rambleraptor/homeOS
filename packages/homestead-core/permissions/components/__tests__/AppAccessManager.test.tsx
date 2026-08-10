/**
 * AppAccessManager: the superuser surface for blocking a person or group from an
 * app. The permissions hooks are spied so no react-query/aepbase wiring is
 * needed; the app list comes from a spied registry.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as toast from '@rambleraptor/homestead-core/shared/components/ToastProvider';
import * as registry from '@rambleraptor/homestead-core/apps/registry';
import * as hooks from '../../hooks';
import { AppAccessManager } from '../AppAccessManager';

function query<T>(data: T) {
  return { data, isLoading: false } as unknown as ReturnType<typeof hooks.useGroups>;
}
function mutation(mutateAsync = vi.fn().mockResolvedValue(undefined)) {
  return { mutateAsync, isPending: false } as unknown as ReturnType<typeof hooks.useBlockAppAccess>;
}

const USERS = [{ id: 'u1', display_name: 'Alice', email: 'alice@example.com' }];
const GROUPS = [{ id: 'g-kids', name: 'Kids' }];
const APPS = [
  { id: 'recipes', name: 'Recipes' },
  { id: 'todos', name: 'Todos' },
];

describe('AppAccessManager', () => {
  const block = vi.fn().mockResolvedValue(undefined);
  const revoke = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.restoreAllMocks();
    block.mockClear();
    revoke.mockClear();
    vi.spyOn(toast, 'useToast').mockReturnValue({
      showToast: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(),
    });
    vi.spyOn(registry, 'getNavigationApps').mockReturnValue(APPS as never);
    vi.spyOn(hooks, 'useAllUsers').mockReturnValue(query(USERS));
    vi.spyOn(hooks, 'useGroups').mockReturnValue(query(GROUPS));
    vi.spyOn(hooks, 'useAppAccessGrants').mockReturnValue(query([]));
    vi.spyOn(hooks, 'useBlockAppAccess').mockReturnValue(mutation(block));
    vi.spyOn(hooks, 'useRevokeGrant').mockReturnValue(mutation(revoke));
  });

  it('shows the empty state when nothing is blocked', () => {
    render(<AppAccessManager />);
    expect(screen.getByTestId('app-access-empty')).toBeInTheDocument();
  });

  it('blocks a group from an app', () => {
    render(<AppAccessManager />);
    fireEvent.change(screen.getByTestId('app-access-subject'), { target: { value: 'group:g-kids' } });
    fireEvent.change(screen.getByTestId('app-access-app'), { target: { value: 'recipes' } });
    fireEvent.click(screen.getByTestId('app-access-block'));
    expect(block).toHaveBeenCalledWith({ appId: 'recipes', subject: { type: 'group', id: 'g-kids' } });
  });

  it('lists an existing block and unblocks it', () => {
    vi.spyOn(hooks, 'useAppAccessGrants').mockReturnValue(
      query([
        {
          id: 'grant1',
          subject_type: 'user',
          subject_id: 'u1',
          target_scope: 'app',
          target_app: 'recipes',
          capability: 'manage',
          effect: 'deny',
        },
      ]),
    );
    render(<AppAccessManager />);
    // Resolves the user's name and the app's name.
    expect(screen.getByTestId('app-access-list')).toHaveTextContent('Alice');
    expect(screen.getByTestId('app-access-list')).toHaveTextContent('Recipes');

    fireEvent.click(screen.getByTestId('app-access-unblock-u1-recipes'));
    expect(revoke).toHaveBeenCalledWith('grant1');
  });

  it('prevents blocking the same subject+app twice', () => {
    vi.spyOn(hooks, 'useAppAccessGrants').mockReturnValue(
      query([
        {
          id: 'grant1',
          subject_type: 'group',
          subject_id: 'g-kids',
          target_scope: 'app',
          target_app: 'recipes',
          capability: 'manage',
          effect: 'deny',
        },
      ]),
    );
    render(<AppAccessManager />);
    fireEvent.change(screen.getByTestId('app-access-subject'), { target: { value: 'group:g-kids' } });
    fireEvent.change(screen.getByTestId('app-access-app'), { target: { value: 'recipes' } });
    expect(screen.getByTestId('app-access-duplicate')).toBeInTheDocument();
    expect(screen.getByTestId('app-access-block')).toBeDisabled();
    fireEvent.click(screen.getByTestId('app-access-block'));
    expect(block).not.toHaveBeenCalled();
  });
});
