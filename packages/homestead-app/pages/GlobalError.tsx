'use client';

/**
 * Root error boundary. Only fires when the root layout itself throws —
 * the `(app)/error.tsx` boundary catches everything beneath it. We
 * still surface the digest so the user has something to send us when
 * they report it.
 */

import { useEffect } from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error(
      `[client-error:root] digest=${error.digest ?? 'none'} ${error.name}: ${error.message}`,
      error,
    );
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          padding: '2rem',
          maxWidth: '40rem',
          margin: '0 auto',
          color: '#1f2937',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
          Something went wrong
        </h1>
        <p style={{ marginBottom: '0.5rem' }}>
          {error.message || 'An unexpected error occurred.'}
        </p>
        {error.digest && (
          <p
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '0.85rem',
              color: '#6b7280',
              marginBottom: '1rem',
            }}
          >
            error id: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          style={{
            padding: '0.5rem 1rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem',
            background: 'white',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
