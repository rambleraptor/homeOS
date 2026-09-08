/**
 * Tests for `ToastProvider`'s undo and celebration toasts.
 *
 * For undo, the contract worth locking down is that the action runs
 * immediately and `onUndo` is what reverses it — the opposite arrangement
 * (defer the action, cancel on undo) loses the write entirely if the tab
 * closes inside the window, and the two are easy to confuse when reading a
 * call site.
 *
 * For celebrate, it is that the toast body is the shared card, so an app's
 * "you did it" moment can't quietly drift into its own styling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from '../ToastProvider';

const toastFn = vi.fn();
const customFn = vi.fn();

vi.mock('sonner', () => ({
  toast: Object.assign((...args: unknown[]) => toastFn(...args), {
    custom: (...args: unknown[]) => customFn(...args),
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

function CelebrateHarness() {
  const toast = useToast();
  return (
    <button
      onClick={() =>
        toast.celebrate('Aldi complete!', {
          description: 'Every item checked off — nice work!',
        })
      }
    >
      celebrate
    </button>
  );
}

beforeEach(() => {
  toastFn.mockClear();
  customFn.mockClear();
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

describe('ToastProvider.celebrate', () => {
  it('shows the shared celebration card with the title and description', async () => {
    render(
      <ToastProvider>
        <CelebrateHarness />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'celebrate' }));

    expect(customFn).toHaveBeenCalledTimes(1);
    const [renderToast] = customFn.mock.calls[0] as [
      (id: string | number) => ReactElement,
    ];
    render(renderToast('toast-1'));

    expect(screen.getByTestId('celebration-toast')).toBeInTheDocument();
    expect(screen.getByText('Aldi complete!')).toBeInTheDocument();
    expect(screen.getByText('Every item checked off — nice work!')).toBeInTheDocument();
  });

  it('dismisses itself: nothing to act on, so it only stays long enough to read', async () => {
    render(
      <ToastProvider>
        <CelebrateHarness />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'celebrate' }));

    const [, options] = customFn.mock.calls[0] as [
      unknown,
      { duration: number; className: string },
    ];
    expect(options.duration).toBeGreaterThan(0);
    expect(options.duration).toBeLessThan(8000);
    expect(options.className).toBe('w-full');
  });
});
