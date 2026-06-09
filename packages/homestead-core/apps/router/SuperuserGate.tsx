import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { Spinner } from '../../shared/components/Spinner';

interface Props {
  children: ReactNode;
  fallbackPath?: string;
}

export function SuperuserGate({ children, fallbackPath = '/dashboard' }: Props) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user && user.type !== 'superuser') {
      navigate(fallbackPath, { replace: true });
    }
  }, [isLoading, user, navigate, fallbackPath]);

  if (isLoading || !user || user.type !== 'superuser') {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}
