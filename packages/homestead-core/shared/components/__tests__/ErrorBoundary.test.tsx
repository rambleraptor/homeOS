/**
 * `<ErrorBoundary>` catches a render exception in its subtree and shows a
 * recoverable fallback instead of letting the error crash the whole tree to a
 * blank page. Covers the default fallback, a custom `fallback`, and the
 * `onError` hook.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary, AppErrorFallback } from '../ErrorBoundary';

function Boom(): never {
  throw new Error('kaboom');
}

describe('<ErrorBoundary>', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <span>all good</span>
      </ErrorBoundary>,
    );
    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  it('shows the default fallback when a child throws', () => {
    // React logs the caught error to console.error; silence it for a clean run.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('renders a custom fallback and calls onError', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();
    render(
      <ErrorBoundary fallback={<AppErrorFallback />} onError={onError}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/failed to load this section/i)).toBeInTheDocument();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    vi.restoreAllMocks();
  });
});
