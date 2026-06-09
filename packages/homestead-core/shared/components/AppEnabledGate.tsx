/**
 * Page-level gate that hides an app's content from viewers who don't
 * pass its built-in `enabled` flag. Mirrors the audience resolution
 * `useIsAppEnabled` performs for the sidebar — `'none'` blocks
 * everyone, `'superusers'` only superusers, `'all'` every signed-in
 * user — but fronted by a UI: a spinner while auth and flags load, a
 * redirect to `fallbackPath` once we know the viewer is disallowed.
 *
 * Use this on nested app pages (and any direct-link surface) so a
 * disabled app isn't reachable just by typing the URL.
 */

import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@rambleraptor/homestead-core/auth/useAuth';
import { useAppFlag } from '@rambleraptor/homestead-core/settings/hooks/useAppFlag';
import {
  DEFAULT_APP_VISIBILITY,
  type AppVisibility,
} from '@rambleraptor/homestead-core/settings/visibility';
import { Spinner } from './Spinner';

interface Props {
  appId: string;
  children: ReactNode;
  /** Where to send disallowed viewers. Defaults to `/dashboard`. */
  fallbackPath?: string;
}

export function AppEnabledGate({
  appId,
  children,
  fallbackPath = '/dashboard',
}: Props) {
  const { user, isLoading: authLoading } = useAuth();
  const { value, isLoading: flagLoading } = useAppFlag<AppVisibility>(
    appId,
    'enabled',
  );
  const navigate = useNavigate();

  const isLoading = authLoading || flagLoading;
  const visibility: AppVisibility = value ?? DEFAULT_APP_VISIBILITY;
  const allowed = !isLoading && resolveVisibility(visibility, user);

  useEffect(() => {
    if (isLoading) return;
    if (!allowed) navigate(fallbackPath, { replace: true });
  }, [isLoading, allowed, navigate, fallbackPath]);

  if (!allowed) {
    return (
      <div
        className="flex items-center justify-center h-64"
        data-testid="app-enabled-gate-loading"
      >
        <Spinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}

function resolveVisibility(
  visibility: AppVisibility,
  user: ReturnType<typeof useAuth>['user'],
): boolean {
  if (visibility === 'none') return false;
  if (!user) return false;
  if (visibility === 'all') return true;
  return user.type === 'superuser';
}
