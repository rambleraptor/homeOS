/**
 * Tests for `ToastProvider`'s undo toast.
 *
 * The contract worth locking down is that the action runs immediately and
 * `onUndo` is what reverses it — the opposite arrangement (defer the action,
 * cancel on undo) loses the write entirely if the tab closes inside the
 * window, and the two are easy to confuse when reading a call site.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from '../ToastProvider';

const toastFn = vi.fn();

vi.mock('sonner', () => ({
  toast: Object.assign((...args: unknown[]) => toastFn(...args), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock('../ui/sonner', () => ({ Toaster: () => null }));

function Harness({ onUndo }: { onUndo: () => void }) {
  const toast = useToast();
  return (
    <button onClick={() => toast.undo('Deleted Milk', onUndo)}>delete</button>
  );
}

beforeEach(() => {
  toastFn.mockClear();
});

describe('ToastProvider.undo', () => {
  it('shows the message with an Undo action', async () => {
    const onUndo = vi.fn();
    render(
      <ToastProvider>
        <Harness onUndo={onUndo} />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'delete' }));

    expect(toastFn).toHaveBeenCalledTimes(1);
    const [message, options] = toastFn.mock.calls[0] as [
      string,
      { action: { label: string; onClick: () => void }; duration: number },
    ];
    expect(message).toBe('Deleted Milk');
    expect(options.action.label).toBe('Undo');
  });

  it('does not call onUndo until the action is clicked', async () => {
    const onUndo = vi.fn();
    render(
      <ToastProvider>
        <Harness onUndo={onUndo} />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'delete' }));
    expect(onUndo).not.toHaveBeenCalled();

    const [, options] = toastFn.mock.calls[0] as [
      string,
      { action: { onClick: () => void } },
    ];
    options.action.onClick();
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('outlives a default toast so there is time to react', async () => {
    render(
      <ToastProvider>
        <Harness onUndo={vi.fn()} />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'delete' }));

    const [, options] = toastFn.mock.calls[0] as [string, { duration: number }];
    expect(options.duration).toBeGreaterThanOrEqual(5000);
  });
});
