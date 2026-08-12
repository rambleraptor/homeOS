/**
 * The dashboard widget. The hook is mocked so the test drives the grouped days
 * directly and asserts what a household member actually reads off the card:
 * when the next pickup is, what goes out, and whether a holiday moved it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PickupDay } from '../utils/pickups';

const useUpcomingPickupDays = vi.fn();
vi.mock('../hooks/useGarbagePickups', () => ({
  useUpcomingPickupDays: (days?: number) => useUpcomingPickupDays(days),
}));

import { NextPickupWidget } from '../components/NextPickupWidget';

const NOW = new Date(2026, 7, 17); // Monday, Aug 17 2026

const day = (
  date: string,
  streams: string[],
  extra: Partial<PickupDay> = {},
): PickupDay => ({
  date,
  daysAway: 0,
  delayed: false,
  pickups: streams.map((stream, i) => ({
    id: `${date}-${i}`,
    pickup_date: date,
    stream,
  })) as PickupDay['pickups'],
  ...extra,
});

function setup() {
  render(
    <MemoryRouter>
      <NextPickupWidget />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  useUpcomingPickupDays.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('NextPickupWidget', () => {
  it('leads with the next day and its streams', () => {
    useUpcomingPickupDays.mockReturnValue({
      data: [day('2026-08-17', ['garbage', 'recyclable'])],
      isLoading: false,
      isError: false,
      error: null,
    });
    setup();

    const widget = screen.getByTestId('next-pickup-widget');
    expect(within(widget).getByText('Today')).toBeInTheDocument();
    expect(within(widget).getByTestId('pickup-stream-garbage')).toHaveTextContent(
      'Trash',
    );
    expect(
      within(widget).getByTestId('pickup-stream-recyclable'),
    ).toHaveTextContent('Recycling');
  });

  it('calls out a holiday delay with its note', () => {
    useUpcomingPickupDays.mockReturnValue({
      data: [
        {
          ...day('2026-08-18', ['garbage']),
          delayed: true,
          pickups: [
            {
              id: 'a',
              pickup_date: '2026-08-18',
              stream: 'garbage',
              status: 'delayed',
              note: 'Thanksgiving — 1 day delay',
            },
          ] as PickupDay['pickups'],
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
    });
    setup();

    expect(screen.getByText('Delayed')).toBeInTheDocument();
    expect(screen.getByText('Thanksgiving — 1 day delay')).toBeInTheDocument();
  });

  it('lists the following days beneath the headline one', () => {
    useUpcomingPickupDays.mockReturnValue({
      data: [
        day('2026-08-17', ['garbage']),
        day('2026-08-24', ['garbage']),
        day('2026-08-31', ['recyclable']),
      ],
      isLoading: false,
      isError: false,
      error: null,
    });
    setup();

    expect(
      screen.getByTestId('next-pickup-following-2026-08-24'),
    ).toHaveTextContent('Trash');
    expect(
      screen.getByTestId('next-pickup-following-2026-08-31'),
    ).toHaveTextContent('Recycling');
    // The headline day isn't repeated in the list beneath it.
    expect(
      screen.queryByTestId('next-pickup-following-2026-08-17'),
    ).not.toBeInTheDocument();
  });

  it('shows an empty state when nothing is scheduled', () => {
    useUpcomingPickupDays.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    });
    setup();
    expect(screen.getByText(/No pickups in the next/)).toBeInTheDocument();
  });

  it('shows a spinner while loading', () => {
    useUpcomingPickupDays.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });
    setup();
    expect(screen.queryByText(/No pickups in the next/)).not.toBeInTheDocument();
  });
});
