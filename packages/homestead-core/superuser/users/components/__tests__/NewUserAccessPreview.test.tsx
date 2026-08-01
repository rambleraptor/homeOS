/**
 * NewUserAccessPreview summarizes what a brand-new user will be able to do,
 * across both layers: app-access gating (always applies) and data access
 * (depends on enforcement + the everyone-scoped grants). Hooks/registry are
 * spied so no providers are needed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as registry from '@rambleraptor/homestead-core/apps/registry';
import * as appFlags from '@rambleraptor/homestead-core/settings/hooks/useAppFlags';
import * as permHooks from '@rambleraptor/homestead-core/permissions/hooks';
import * as authHook from '@rambleraptor/homestead-core/auth/useAuth';
import { NewUserAccessPreview } from '../NewUserAccessPreview';

const APPS = [
  { id: 'recipes', name: 'Recipes', defaultEnabled: 'all' },
  { id: 'superuser', name: 'Superuser', defaultEnabled: 'superusers' },
];

const OPEN_GRANT = {
  id: 'open-household',
  subject_type: 'everyone',
  target_scope: 'all',
  capability: 'write',
  effect: 'allow',
};

function setup({ enforced = true, grants = [] as unknown[] } = {}) {
  vi.spyOn(registry, 'getNavigationApps').mockReturnValue(APPS as never);
  vi.spyOn(appFlags, 'useAppFlags').mockReturnValue({ values: {}, record: null } as never);
  vi.spyOn(permHooks, 'useAccessGrants').mockReturnValue({ data: grants } as never);
  vi.spyOn(authHook, 'useAuth').mockReturnValue({
    user: { permissions: { enforced } },
  } as never);
}

describe('NewUserAccessPreview', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('a regular user under the open-household grant gets full shared access + all-visibility apps', () => {
    setup({ enforced: true, grants: [OPEN_GRANT] });
    render(<NewUserAccessPreview type="regular" />);
    expect(screen.getByText(/read and write all shared household data/i)).toBeInTheDocument();
    // Only the 'all'-visibility app is openable by a group-less regular user.
    expect(screen.getByText(/Can open 1 app: Recipes\./)).toBeInTheDocument();
  });

  it('a regular user in a locked-down household starts with no data access', () => {
    setup({ enforced: true, grants: [] });
    render(<NewUserAccessPreview type="regular" />);
    expect(screen.getByText(/No data access yet/i)).toBeInTheDocument();
  });

  it('when enforcement is off, a new user can do everything', () => {
    setup({ enforced: false, grants: [] });
    render(<NewUserAccessPreview type="regular" />);
    expect(screen.getByText(/permissions are not being enforced yet/i)).toBeInTheDocument();
  });

  it('a superuser gets a full-access (break-glass) note and can open superuser apps', () => {
    setup({ enforced: true, grants: [] });
    render(<NewUserAccessPreview type="superuser" />);
    expect(screen.getByText(/bypass every restriction \(break-glass\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Can open 2 apps: Recipes, Superuser\./)).toBeInTheDocument();
  });
});
