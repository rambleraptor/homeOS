/**
 * Tests for RemindersSection — the body of the Events page's Reminders tab.
 *
 * The data hooks are mocked so the section's own behavior (splitting pending
 * from done, folding away app-raised reminders, the toggles, the overdue label,
 * the empty states) is what's under test, not the resource-hook plumbing.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { ToastProvider } from '@rambleraptor/homestead-core/shared/components/ToastProvider';
import { RemindersSection } from '../components/RemindersSection';
import type { Reminder } from '../types';

vi.mock('../hooks/useReminders', () => ({ useReminders: vi.fn() }));
vi.mock('../hooks/useCreateReminder', () => ({ useCreateReminder: vi.fn() }));
vi.mock('../hooks/useUpdateReminder', () => ({ useUpdateReminder: vi.fn() }));
vi.mock('../hooks/useDeleteReminder', () => ({ useDeleteReminder: vi.fn() }));

import { useReminders } from '../hooks/useReminders';
import { useCreateReminder } from '../hooks/useCreateReminder';
import { useUpdateReminder } from '../hooks/useUpdateReminder';
import { useDeleteReminder } from '../hooks/useDeleteReminder';

const updateMutateAsync = vi.fn(async () => undefined);
const createMutateAsync = vi.fn(async () => undefined);
const deleteMutateAsync = vi.fn(async () => undefined);

/** Local-time ISO, so "overdue" and "today" mean the same here as in the UI. */
function isoAt(offsetDays: number, hour = 9): string {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + offsetDays,
    hour,
  ).toISOString();
}

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <RemindersSection />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function mockReminders(data: Reminder[], isLoading = false) {
  vi.mocked(useReminders).mockReturnValue({
    data,
    isLoading,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as UseQueryResult<Reminder[], Error>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useCreateReminder).mockReturnValue({
    mutateAsync: createMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useCreateReminder>);
  vi.mocked(useUpdateReminder).mockReturnValue({
    mutateAsync: updateMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateReminder>);
  vi.mocked(useDeleteReminder).mockReturnValue({
    mutateAsync: deleteMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useDeleteReminder>);
});

describe('RemindersSection', () => {
  it('invites a first reminder when there are none', () => {
    mockReminders([]);
    renderSection();
    expect(screen.getByTestId('reminders-empty')).toHaveTextContent(
      /No reminders yet/i,
    );
  });

  it('lists pending reminders and hides done ones behind a toggle', async () => {
    const user = userEvent.setup();
    mockReminders([
      { id: 'r1', title: 'Call the plumber', due_at: isoAt(1), status: 'pending' },
      { id: 'r2', title: 'Renew passport', due_at: isoAt(2), status: 'done' },
    ]);
    renderSection();

    expect(screen.getByText('Call the plumber')).toBeInTheDocument();
    expect(screen.queryByText('Renew passport')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('reminders-toggle-done'));
    expect(screen.getByText('Renew passport')).toBeInTheDocument();
  });

  it('offers no done toggle when nothing is done', () => {
    mockReminders([
      { id: 'r1', title: 'Call the plumber', due_at: isoAt(1), status: 'pending' },
    ]);
    renderSection();
    expect(screen.queryByTestId('reminders-toggle-done')).not.toBeInTheDocument();
  });

  it('says everything is done when only done reminders remain', () => {
    mockReminders([
      { id: 'r1', title: 'Call the plumber', due_at: isoAt(-1), status: 'done' },
    ]);
    renderSection();
    expect(screen.getByTestId('reminders-empty')).toHaveTextContent(
      /every reminder is done/i,
    );
  });

  it('flags a past-due pending reminder as overdue', () => {
    mockReminders([
      { id: 'r1', title: 'Call the plumber', due_at: isoAt(-1), status: 'pending' },
    ]);
    renderSection();
    expect(screen.getByTestId('reminder-due-r1')).toHaveTextContent('Overdue');
  });

  it('does not call a past-due done reminder overdue', async () => {
    const user = userEvent.setup();
    mockReminders([
      { id: 'r1', title: 'Call the plumber', due_at: isoAt(-1), status: 'done' },
    ]);
    renderSection();
    await user.click(screen.getByTestId('reminders-toggle-done'));
    expect(screen.getByTestId('reminder-due-r1')).not.toHaveTextContent('Overdue');
  });

  it('marks a pending reminder done', async () => {
    const user = userEvent.setup();
    mockReminders([
      { id: 'r1', title: 'Call the plumber', due_at: isoAt(1), status: 'pending' },
    ]);
    renderSection();

    await user.click(screen.getByTestId('reminder-toggle-r1'));
    await waitFor(() =>
      expect(updateMutateAsync).toHaveBeenCalledWith({
        id: 'r1',
        data: { status: 'done' },
      }),
    );
  });

  it('puts a done reminder back to pending', async () => {
    const user = userEvent.setup();
    mockReminders([
      { id: 'r1', title: 'Call the plumber', due_at: isoAt(1), status: 'done' },
    ]);
    renderSection();

    await user.click(screen.getByTestId('reminders-toggle-done'));
    await user.click(screen.getByTestId('reminder-toggle-r1'));
    await waitFor(() =>
      expect(updateMutateAsync).toHaveBeenCalledWith({
        id: 'r1',
        data: { status: 'pending' },
      }),
    );
  });

  it('creates a reminder from the form, defaulting the time', async () => {
    const user = userEvent.setup();
    mockReminders([]);
    renderSection();

    await user.click(screen.getByTestId('add-reminder-button'));
    await user.type(screen.getByTestId('reminder-form-title'), 'Move the car');
    await user.type(screen.getByTestId('reminder-form-date'), '2026-03-04');
    await user.click(screen.getByTestId('reminder-form-submit'));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    expect(createMutateAsync).toHaveBeenCalledWith({
      title: 'Move the car',
      due_at: new Date(2026, 2, 4, 9, 0).toISOString(),
      status: 'pending',
      visibility: 'household',
      // Stamped from the signed-in user so the delivery cron can address a
      // private reminder; the shared test setup's mock user.
      created_by: 'test-user-id',
    });
  });

  it('creates a private reminder when "Just me" is chosen', async () => {
    const user = userEvent.setup();
    mockReminders([]);
    renderSection();

    await user.click(screen.getByTestId('add-reminder-button'));
    await user.type(screen.getByTestId('reminder-form-title'), 'Buy her present');
    await user.type(screen.getByTestId('reminder-form-date'), '2026-03-04');
    await user.click(screen.getByTestId('reminder-form-visibility-private'));
    await user.click(screen.getByTestId('reminder-form-submit'));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    expect(createMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Buy her present', visibility: 'private' }),
    );
  });

  it('marks a private reminder in the list', () => {
    mockReminders([
      {
        id: 'r1',
        title: 'Buy her present',
        due_at: isoAt(3),
        status: 'pending',
        visibility: 'private',
      },
    ]);
    renderSection();
    expect(screen.getByTestId('reminder-private-r1')).toBeInTheDocument();
  });

  it('does not mark a household reminder', () => {
    mockReminders([
      {
        id: 'r1',
        title: 'Bins out',
        due_at: isoAt(1),
        status: 'pending',
        visibility: 'household',
      },
    ]);
    renderSection();
    expect(screen.queryByTestId('reminder-private-r1')).not.toBeInTheDocument();
  });

  it('offers no visibility control when editing — the field is immutable', async () => {
    const user = userEvent.setup();
    mockReminders([
      {
        id: 'r1',
        title: 'Call the plumber',
        due_at: isoAt(1),
        status: 'pending',
        visibility: 'private',
      },
    ]);
    renderSection();

    await user.click(screen.getByTestId('reminder-edit-r1'));
    await screen.findByTestId('reminder-form-title');
    expect(
      screen.queryByTestId('reminder-form-visibility-private'),
    ).not.toBeInTheDocument();
  });

  it('omits visibility from an update payload', async () => {
    const user = userEvent.setup();
    mockReminders([
      {
        id: 'r1',
        title: 'Call the plumber',
        due_at: isoAt(1),
        status: 'pending',
        visibility: 'private',
      },
    ]);
    renderSection();

    await user.click(screen.getByTestId('reminder-edit-r1'));
    const title = await screen.findByTestId('reminder-form-title');
    await user.clear(title);
    await user.type(title, 'Call the electrician');
    await user.click(screen.getByTestId('reminder-form-submit'));

    // Sending it would be a 400 — the engine refuses an immutable field on update.
    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
    const [[vars]] = updateMutateAsync.mock.calls as unknown as [
      [{ id: string; data: Record<string, unknown> }],
    ];
    expect(vars.data).not.toHaveProperty('visibility');
    expect(vars.data.title).toBe('Call the electrician');
  });

  it('shows a spinner while loading', () => {
    mockReminders([], true);
    renderSection();
    expect(screen.queryByTestId('reminders-empty')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reminders-list')).not.toBeInTheDocument();
  });

  it('folds app-raised reminders away behind a count', async () => {
    const user = userEvent.setup();
    mockReminders([
      { id: 'r1', title: 'Call the plumber', due_at: isoAt(1), status: 'pending' },
      {
        id: 'r2',
        title: 'Bins out tonight: Trash',
        due_at: isoAt(1),
        status: 'pending',
        type: 'home',
        source_key: 'pickup:2026-03-05',
      },
    ]);
    renderSection();

    expect(screen.getByText('Call the plumber')).toBeInTheDocument();
    expect(screen.queryByText(/Bins out tonight/)).not.toBeInTheDocument();

    await user.click(screen.getByTestId('reminders-toggle-app'));
    expect(screen.getByText(/Bins out tonight/)).toBeInTheDocument();
  });

  it('offers no app toggle when nothing was app-raised', () => {
    mockReminders([
      { id: 'r1', title: 'Call the plumber', due_at: isoAt(1), status: 'pending' },
    ]);
    renderSection();
    expect(screen.queryByTestId('reminders-toggle-app')).not.toBeInTheDocument();
  });

  it('still invites a first reminder when only app ones exist', () => {
    mockReminders([
      {
        id: 'r2',
        title: 'Today: Mum’s birthday',
        due_at: isoAt(0),
        status: 'pending',
        type: 'events',
      },
    ]);
    renderSection();
    expect(screen.getByTestId('reminders-empty')).toHaveTextContent(
      /No reminders yet/i,
    );
  });

  it('labels an app reminder and leaves it read-only', async () => {
    const user = userEvent.setup();
    mockReminders([
      {
        id: 'r2',
        title: 'Today: Mum’s birthday',
        due_at: isoAt(0),
        status: 'pending',
        type: 'events',
      },
    ]);
    renderSection();
    await user.click(screen.getByTestId('reminders-toggle-app'));

    expect(screen.getByTestId('reminder-app-r2')).toBeInTheDocument();
    // Editing or deleting would be undone by the next materializer run; the
    // checkbox (dismiss) is the only honest control.
    expect(screen.queryByTestId('reminder-edit-r2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reminder-delete-r2')).not.toBeInTheDocument();
    expect(screen.getByTestId('reminder-toggle-r2')).toBeInTheDocument();
  });
});
