/**
 * Tests for the Events page's two tabs.
 *
 * The two panels are stubbed — what's under test is the tab machinery itself:
 * which panel renders, that the choice round-trips through the URL (so a
 * reminder notification can deep-link to `?tab=reminders`), and that "Add Event"
 * only offers itself on the tab it belongs to.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@rambleraptor/homestead-core/shared/components/ToastProvider';

vi.mock('../components/EventsList', () => ({
  EventsList: () => <div data-testid="stub-events-list" />,
}));
vi.mock('../components/RemindersSection', () => ({
  RemindersSection: () => <div data-testid="stub-reminders-section" />,
}));
vi.mock('../hooks/useCreateEvent', () => ({ useCreateEvent: vi.fn() }));

import { EventsHome } from '../components/EventsHome';
import { useCreateEvent } from '../hooks/useCreateEvent';

function renderPage(initialPath = '/events') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <EventsHome />
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useCreateEvent).mockReturnValue({
    mutateAsync: vi.fn(async () => undefined),
    isPending: false,
  } as unknown as ReturnType<typeof useCreateEvent>);
});

describe('EventsHome tabs', () => {
  it('opens on the events tab', () => {
    renderPage();
    expect(screen.getByTestId('stub-events-list')).toBeInTheDocument();
    expect(screen.queryByTestId('stub-reminders-section')).not.toBeInTheDocument();
    expect(screen.getByTestId('events-tab-events')).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('switches to reminders', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId('events-tab-reminders'));

    expect(screen.getByTestId('stub-reminders-section')).toBeInTheDocument();
    expect(screen.queryByTestId('stub-events-list')).not.toBeInTheDocument();
  });

  it('opens straight onto reminders when the URL says so', () => {
    renderPage('/events?tab=reminders');
    expect(screen.getByTestId('stub-reminders-section')).toBeInTheDocument();
    expect(screen.getByTestId('events-tab-reminders')).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('falls back to events for an unrecognized tab', () => {
    renderPage('/events?tab=nonsense');
    expect(screen.getByTestId('stub-events-list')).toBeInTheDocument();
  });

  it('offers Add Event only on the events tab', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByTestId('add-event-button')).toBeInTheDocument();

    await user.click(screen.getByTestId('events-tab-reminders'));
    expect(screen.queryByTestId('add-event-button')).not.toBeInTheDocument();
  });
});
