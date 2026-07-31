import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { useCan } from '../../permissions/useCan';
import { Spinner } from '../../shared/components/Spinner';
import type { Verb } from '../../permissions/resolve';

interface Props {
  verb: Verb;
  resourceType: string;
  children: ReactNode;
  fallbackPath?: string;
}

/**
 * Route guard for a resource capability (design §10). Redirects to
 * `fallbackPath` when `can(verb, resourceType)` is false. UX only — the server
 * still enforces; `can()` is permissive when enforcement is off, so this never
 * over-blocks.
 *
 * In practice this only mounts inside `AppShell`'s `AuthGuard`, which already
 * bounces an unauthenticated visitor to `/login`, so `user` is non-null here.
 * The redirect below still fires on a null user (not just a disallowed one) as
 * defense in depth: were the gate ever rendered outside that guard, it would
 * redirect rather than spin forever (and `fallbackPath` itself sits under the
 * AuthGuard, so an unauthenticated user still lands on login).
 */
export function PermissionGate({ verb, resourceType, children, fallbackPath = '/dashboard' }: Props) {
  const { user, isLoading } = useAuth();
  const can = useCan();
  const navigate = useNavigate();
  const allowed = !!user && can(verb, resourceType);

  useEffect(() => {
    if (!isLoading && !allowed) {
      navigate(fallbackPath, { replace: true });
    }
  }, [isLoading, allowed, navigate, fallbackPath]);

  if (isLoading || !user || !allowed) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}
