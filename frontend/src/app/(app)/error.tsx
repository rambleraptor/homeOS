'use client';

/**
 * App-segment error boundary. Catches errors that bubble out of the
 * catch-all module router (and any in-tree app routes). The `digest`
 * is the same id `instrumentation.onRequestError` logs server-side, so
 * we surface it prominently — it's the only handle we have to match
 * a user-visible 500 against a server stack trace.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Mirror to the browser console with the digest so we can grep
    // either side for the same id when triaging.
    console.error(
      `[client-error] digest=${error.digest ?? 'none'} ${error.name}: ${error.message}`,
      error,
    );
  }, [error]);

  return (
    <div className="space-y-4">
      <div className="bg-red-50/20 border border-red-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-2 min-w-0">
            <h3 className="font-semibold text-red-900">Something went wrong</h3>
            <p className="text-sm text-red-700">
              {error.message || 'An unexpected error occurred.'}
            </p>
            {error.digest && (
              <p className="text-xs font-mono text-red-700/80 break-all">
                error id: {error.digest}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-bg-pearl text-brand-navy"
          >
            <RotateCcw className="w-4 h-4" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-bg-pearl text-brand-navy"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
