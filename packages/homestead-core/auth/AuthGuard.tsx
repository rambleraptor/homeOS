/**
 * AuthGuard Component
 *
 * Protects routes that require authentication.
 * Redirects unauthenticated users to login page.
 */

import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { Spinner } from '../shared/components/Spinner';

interface AuthGuardProps {
  children: React.ReactNode;
  /**
   * Path to redirect to if not authenticated
   * @default '/login'
   */
  redirectTo?: string;
  /**
   * Show loading spinner while checking auth
   * @default true
   */
  showLoading?: boolean;
}

export function AuthGuard({
  children,
  redirectTo = '/login',
  showLoading = true,
}: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Save the location they were trying to access via query param
      const returnUrl = encodeURIComponent(pathname);
      navigate(`${redirectTo}?returnUrl=${returnUrl}`, { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate, pathname, redirectTo]);

  if (isLoading) {
    if (!showLoading) return null;

    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Spinner size="xl" label={null} className="mx-auto" />
          <p className="mt-4 font-body text-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Return null while redirect is happening
    return null;
  }

  return <>{children}</>;
}
