/**
 * The Reminders tab is read-only now — reminders moved to the notifications
 * app as `scheduled-notification` rows. What's left to test is that the
 * transition reads correctly: the banner points somewhere useful, leftover
 * app-raised rows are hidden (their producers rebuild them as scheduled
 * notifications, so the copies here are stale), and nothing on the page can
 * write to a collection the next release drops.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import { RemindersSection } from '../components/RemindersSection';
import type { Reminder } from '../types';

const mockUseReminders = vi.fn();
vi.mock('../hooks/useReminders', () => ({
  useReminders: () => mockUseReminders(),
}));

function reminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: 'r1',
    title: 'Call the plumber',
    due_at: new Date(2026, 5, 20, 9).toISOString(),
    status: 'pending',
    ...overrides,
  };
}

function renderWith(data: Reminder[], isLoading = false) {
  mockUseReminders.mockReturnValue({ data, isLoading });
  return render(
    <MemoryRouter>
      <RemindersSection />
    </MemoryRouter>,
  );
}

describe('RemindersSection', () => {
  test('points at where reminders actually live now', () => {
    renderWith([]);
    const banner = screen.getByTestId('reminders-moved-banner');
    expect(banner).toHaveTextContent(/reminders have moved/i);
    expect(
      screen.getAllByRole('link', { name: /notifications → scheduled/i })[0],
    ).toHaveAttribute('href', '/notifications?tab=scheduled');
  });

  test('lists what a person typed, so nothing looks lost mid-migration', () => {
    renderWith([reminder()]);
    expect(screen.getByTestId('reminder-row-r1')).toHaveTextContent(
      'Call the plumber',
    );
  });

  test('hides rows an app raised — those are live in the queue, stale here', () => {
    renderWith([
      reminder(),
      reminder({ id: 'r2', title: 'Bins out tonight', type: 'home' }),
    ]);
    expect(screen.getByTestId('reminder-row-r1')).toBeInTheDocument();
    expect(screen.queryByTestId('reminder-row-r2')).not.toBeInTheDocument();
  });

  test('offers no way to add, edit or delete', () => {
    renderWith([reminder()]);
    // The write paths are gone deliberately: the adoption migration ran once,
    // so anything created here afterwards would never reach the queue.
    expect(screen.queryByTestId('add-reminder-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reminder-edit-r1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reminder-delete-r1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reminder-toggle-r1')).not.toBeInTheDocument();
  });

  test('shows a done reminder as done rather than hiding it', () => {
    renderWith([reminder({ status: 'done' })]);
    expect(screen.getByTestId('reminder-row-r1')).toHaveTextContent('done');
  });

  test('says where to go when there is nothing left', () => {
    renderWith([]);
    expect(screen.getByTestId('reminders-empty')).toBeInTheDocument();
  });
});
