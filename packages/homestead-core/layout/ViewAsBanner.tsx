/**
 * "View as user" preview banner.
 *
 * Rendered at the top of the content column (above the header) whenever a
 * superuser is previewing the app as another user. It's the always-visible
 * signal that the current access surface isn't the superuser's own, and the
 * single control for leaving the preview.
 *
 * The exit path reads from `realUser`/`stopViewAs`, never from the effective
 * `user` — so it stays reachable even though the preview has (correctly) hidden
 * every superuser-only surface from the effective identity.
 */

import { useNavigate } from 'react-router-dom';
import { Eye, X } from 'lucide-react';
import { useAuth } from '../auth/useAuth';

export function ViewAsBanner() {
  const { viewAs, stopViewAs } = useAuth();
  const navigate = useNavigate();

  if (!viewAs) return null;

  const handleExit = () => {
    stopViewAs();
    // Return to the admin surface the preview was launched from.
    navigate('/superuser/users');
  };

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="view-as-banner"
      className="flex items-center justify-between gap-3 bg-accent-terracotta px-4 py-2 text-sm text-white shadow-sm"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Eye className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        <span className="truncate">
          Previewing Homestead as{' '}
          <span className="font-semibold">{viewAs.name}</span>
          {viewAs.type === 'superuser' ? ' (superuser)' : ''}. You&apos;re seeing
          only what their permissions allow.
        </span>
      </div>
      <button
        type="button"
        onClick={handleExit}
        data-testid="exit-view-as"
        className="flex items-center gap-1 flex-shrink-0 rounded-md bg-white/15 px-2.5 py-1 font-medium hover:bg-white/25 transition-colors"
      >
        <X className="w-4 h-4" aria-hidden="true" />
        Exit preview
      </button>
    </div>
  );
}
