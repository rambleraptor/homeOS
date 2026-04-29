import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const sonnerCustom = vi.fn(
  (
    render: (id: string | number) => React.ReactNode,
    _options?: { duration?: number }
  ) => {
    void render('test-id');
    return 'test-id';
  }
);
const sonnerDismiss = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    custom: (...args: unknown[]) =>
      sonnerCustom(
        ...(args as [
          (id: string | number) => React.ReactNode,
          { duration?: number } | undefined,
        ])
      ),
    dismiss: (...args: unknown[]) => sonnerDismiss(...args),
  },
}));

import {
  ErrorToast,
  normalizeErrorMessage,
  showError,
} from '../ErrorToast';

describe('normalizeErrorMessage', () => {
  it.each([
    ['Error instance', new Error('boom'), 'boom'],
    ['non-empty string', 'plain message', 'plain message'],
    ['object with .message', { message: 'duck typed' }, 'duck typed'],
    ['null', null, 'Something went wrong'],
    ['undefined', undefined, 'Something went wrong'],
    ['number', 42, 'Something went wrong'],
    ['empty string', '   ', 'Something went wrong'],
    ['object with non-string message', { message: 5 }, 'Something went wrong'],
    ['Error with empty message', new Error(''), 'Something went wrong'],
  ])('handles %s', (_label, input, expected) => {
    expect(normalizeErrorMessage(input)).toBe(expected);
  });
});

describe('showError', () => {
  beforeEach(() => {
    sonnerCustom.mockClear();
    sonnerDismiss.mockClear();
  });

  it('passes the normalized message as the title to toast.custom', () => {
    showError(new Error('kaboom'));
    expect(sonnerCustom).toHaveBeenCalledTimes(1);
    const [, options] = sonnerCustom.mock.calls[0];
    expect(options).toEqual({ duration: 6000 });
  });

  it('uses the custom title when provided', () => {
    showError(new Error('raw'), { title: 'Friendly title' });
    const renderFn = sonnerCustom.mock.calls[0][0];
    const { getByTestId } = render(<>{renderFn('id-1')}</>);
    expect(getByTestId('error-toast').textContent).toContain('Friendly title');
  });

  it('honors a custom duration', () => {
    showError('msg', { duration: 1234 });
    expect(sonnerCustom.mock.calls[0][1]).toEqual({ duration: 1234 });
  });
});

describe('ErrorToast component', () => {
  beforeEach(() => {
    sonnerDismiss.mockClear();
  });

  it('renders the title', () => {
    render(<ErrorToast toastId="x" title="Oh no" />);
    expect(screen.getByTestId('error-toast')).toHaveTextContent('Oh no');
  });

  it('renders the description when provided', () => {
    render(
      <ErrorToast toastId="x" title="Oh no" description="more detail" />
    );
    expect(screen.getByText('more detail')).toBeInTheDocument();
  });

  it('omits the description node when not provided', () => {
    render(<ErrorToast toastId="x" title="Oh no" />);
    expect(screen.queryByText(/more detail/)).not.toBeInTheDocument();
  });

  it('dismiss button calls sonner.dismiss with the toast id', async () => {
    render(<ErrorToast toastId="abc-123" title="Oh no" />);
    await userEvent.click(screen.getByTestId('error-toast-dismiss'));
    expect(sonnerDismiss).toHaveBeenCalledWith('abc-123');
  });
});
