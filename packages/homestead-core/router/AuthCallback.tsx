/**
 * OAuth callback page
 *
 * aepbase finishes the authorization-code exchange and 302-redirects the
 * browser here with a bare token in the URL *fragment* (so it never lands in
 * server logs or the Referer header):
 *
 *   /auth/callback#token=…   (success)
 *
 * On success we hand the token to AuthContext (which resolves the user via the
 * whoami endpoint and hydrates preferences, same as password login) and
 * navigate to the dashboard. Provider/registration failures are rendered by
 * aepbase's callback as a JSON error before this page loads, so here we only
 * need to handle a missing token.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Home, AlertCircle } from 'lucide-react';

function parseFragment(): URLSearchParams {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  return new URLSearchParams(hash);
}

export function AuthCallback() {
  const { completeOAuthLogin } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = parseFragment().get('token');

    if (!token) {
      setError('Sign-in failed: the response was missing a token. Please try again.');
      return;
    }

    let active = true;
    completeOAuthLogin(token)
      .then(() => {
        if (active) navigate('/dashboard', { replace: true });
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to complete sign-in.');
        }
      });
    return () => {
      active = false;
    };
  }, [completeOAuthLogin, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-pearl px-4 py-12">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-surface-white rounded-2xl shadow-sm mb-4">
          <Home className="w-8 h-8 text-brand-navy" />
        </div>
        {error ? (
          <div
            className="bg-surface-white rounded-2xl border border-gray-100 shadow-sm p-8"
            data-testid="oauth-callback-error"
          >
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm font-body text-red-600 text-left">{error}</p>
            </div>
            <a
              href="/login"
              className="inline-block w-full py-3 px-4 rounded-lg text-base font-body font-semibold text-white bg-accent-terracotta hover:bg-accent-terracotta-hover transition-colors"
            >
              Back to sign in
            </a>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-text-muted">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-navy" />
            <p className="font-body">Signing you in…</p>
          </div>
        )}
      </div>
    </div>
  );
}
