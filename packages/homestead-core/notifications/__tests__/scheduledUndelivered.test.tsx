/**
 * Tests for surfacing reminders that never reached anyone.
 *
 * The dispatcher marks a row `missed` (instance offline past the grace window)
 * or `failed` (delivery kept erroring) specifically so the outcome isn't
 * silent — the whole argument for having those states rather than quietly
 * dropping the row. That only holds if the UI says something, which until now
 * it didn't: both were folded away behind the collapsed "Past" disclosure with
 * a neutral badge.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ToastProvider } from '@rambleraptor/homestead-core/shared/components/ToastProvider';
import { ScheduledSection } from '../components/ScheduledSection';
import type { ScheduledNotification } from '../types';

const mockUseScheduled = vi.fn();
vi.mock('../hooks/useScheduledNotifications', () => ({
  useScheduledNotifications: () => mockUseScheduled(),
}));
vi.mock('../hooks/useScheduleNotification', () => ({
  useScheduleNotification: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateScheduledNotification: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCancelScheduledNotification: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@rambleraptor/homestead-core/apps/registry', () => ({
  getAppById: () => ({ name: 'Home', web: { basePath: '/home' } }),
}));

function row(overrides: Partial<ScheduledNotification> = {}): ScheduledNotification {
  return {
    id: 's1',
    title: 'Bins out tonight',
    message: 'Trash and Recycling.',
    send_at: new Date('2026-06-15T18:00:00Z').toISOString(),
    status: 'scheduled',
    ...overrides,
  };
}

function renderWith(data: ScheduledNotification[]) {
  mockUseScheduled.mockReturnValue({ data, isLoading: false });
  return render(
    <MemoryRouter>
      <ToastProvider>
        <ScheduledSection />
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockUseScheduled.mockReset();
});

describe('undelivered reminders', () => {
  test('a missed reminder is called out, with why', () => {
    renderWith([row({ status: 'missed' })]);

    const alert = screen.getByTestId('scheduled-undelivered');
    expect(alert).toHaveTextContent(/didn't reach you/i);
    expect(alert).toHaveTextContent(/offline when it came due/i);
    expect(alert).toHaveTextContent('Bins out tonight');
  });

  test('a failed reminder says something different from a missed one', () => {
    renderWith([row({ status: 'failed' })]);
    expect(screen.getByTestId('scheduled-undelivered')).toHaveTextContent(
      /delivery failed/i,
    );
  });

  test('sent and cancelled reminders raise nothing — they are fine', () => {
    renderWith([row({ id: 'a', status: 'sent' }), row({ id: 'b', status: 'canceled' })]);
    expect(screen.queryByTestId('scheduled-undelivered')).not.toBeInTheDocument();
  });

  test('a healthy queue raises nothing', () => {
    renderWith([row()]);
    expect(screen.queryByTestId('scheduled-undelivered')).not.toBeInTheDocument();
  });

  test('counts read naturally in the singular and plural', () => {
    renderWith([row({ status: 'missed' })]);
    expect(screen.getByTestId('scheduled-undelivered')).toHaveTextContent(
      "1 reminder didn't reach you",
    );
  });

  test('a long outage summarises rather than listing everything', () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      row({ id: `m${i}`, title: `Reminder ${i}`, status: 'missed' }),
    );
    renderWith(many);

    const alert = screen.getByTestId('scheduled-undelivered');
    expect(alert).toHaveTextContent("6 reminders didn't reach you");
    expect(alert).toHaveTextContent(/and 3 more, under Past/i);
    expect(screen.queryByTestId('scheduled-undelivered-m5')).not.toBeInTheDocument();
  });
});
