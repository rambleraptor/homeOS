/**
 * UserAccessSummary resolves an *existing* user's effective access from the
 * context the superuser-only `/api/permissions/user/:id` route returns, and runs
 * the real `canWith` resolver over it. The hook and app registry are spied so no
 * providers or network are needed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as registry from '@rambleraptor/homestead-core/apps/registry';
import * as permHooks from '@rambleraptor/homestead-core/permissions/hooks';
import { UserAccessSummary } from '../UserAccessSummary';
import type { ManagedUser } from '../../types';

// `isSuperuserOnlyApp` keys off a `superuser` route gate; `primaryResource` off
// the first declared resource. Each app id doubles as its app-scope grant target.
const APPS = [
  { id: 'recipes', name: 'Recipes', web: { routes: [{ gates: [] }] }, resources: [{ singular: 'recipe' }] },
  { id: 'pictionary', name: 'Pictionary', web: { routes: [{ gates: [] }] }, resources: [{ singular: 'pictionary-game' }] },
  { id: 'superuser', name: 'Superuser', web: { routes: [{ gates: ['superuser'] }] }, resources: [] },
];

const OPEN_GRANT = {
  subject: { type: 'everyone' },
  capability: 'write',
  effect: 'allow',
  target: { scope: 'all' },
};

const regular: ManagedUser = { id: 'mom', email: 'mom@example.com', type: 'regular' };
const superuser: ManagedUser = { id: 'admin', email: 'admin@example.com', type: 'superuser' };

function mockContext(ctx: unknown, isLoading = false) {
  vi.spyOn(permHooks, 'useUserPermissionContext').mockReturnValue({
    data: ctx,
    isLoading,
  } as never);
}

describe('UserAccessSummary', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(registry, 'getNavigationApps').mockReturnValue(APPS as never);
  });

  it('a user under the open-household grant can read/write everything and open all feature apps', () => {
    mockContext({ enforced: true, groupIds: [], groupNames: [], grants: [OPEN_GRANT] });
    render(<UserAccessSummary user={regular} />);
    expect(screen.getByText(/read and write all shared household data/i)).toBeInTheDocument();
    // The superuser-only app is excluded for a regular user.
    expect(screen.getByText(/Can open 2 apps: Recipes, Pictionary\./)).toBeInTheDocument();
  });

  it('a user with only an app-scope grant is limited to that one app', () => {
    mockContext({
      enforced: true,
      groupIds: [],
      groupNames: [],
      grants: [
        { subject: { type: 'user', id: 'mom' }, capability: 'write', effect: 'allow', target: { scope: 'app', app: 'pictionary' } },
      ],
    });
    render(<UserAccessSummary user={regular} />);
    expect(screen.getByText(/Access is limited to specific apps and records/i)).toBeInTheDocument();
    expect(screen.getByText(/Can open 1 app: Pictionary\./)).toBeInTheDocument();
  });

  it('lists the groups a user belongs to', () => {
    mockContext({ enforced: true, groupIds: ['g1'], groupNames: ['Adults'], grants: [OPEN_GRANT] });
    render(<UserAccessSummary user={regular} />);
    expect(screen.getByText(/In group: Adults\./)).toBeInTheDocument();
  });

  it('a superuser gets a break-glass note and can open every app (context not required)', () => {
    mockContext(undefined); // superuser summary does not depend on the fetched context
    render(<UserAccessSummary user={superuser} />);
    expect(screen.getByText(/bypass every restriction \(break-glass\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Can open 3 apps: Recipes, Pictionary, Superuser\./)).toBeInTheDocument();
  });

  it('shows a loading state for a regular user until the context arrives', () => {
    mockContext(undefined, true);
    render(<UserAccessSummary user={regular} />);
    expect(screen.getByText(/Loading access…/i)).toBeInTheDocument();
  });
});
