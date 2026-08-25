/**
 * The Today card. `useToday` is mocked so the test drives the assembled items
 * directly and asserts what a household member reads off the card — the lane
 * logic itself is covered by `lanes.test.ts`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { TodayItem } from '../types';

const useToday = vi.fn();
vi.mock('../hooks/useToday', () => ({
  useToday: () => useToday(),
}));

import { TodayWidget } from '../components/TodayWidget';

const item = (over: Partial<TodayItem> = {}): TodayItem => ({
  id: 'e1',
  lane: 'event',
  title: 'Marcus',
  detail: 'birthday today',
  href: '/events',
  urgency: 'now',
  ...over,
});

function setup() {
  render(
    <MemoryRouter>
      <TodayWidget />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useToday.mockReset();
});

describe('TodayWidget', () => {
  it('renders a line per item, with its detail', () => {
    useToday.mockReturnValue({
      items: [
        item(),
        item({
          id: 'g',
          lane: 'groceries',
          title: '9 items to pick up',
          detail: '6 at Costco, 3 at H-E-B',
          href: '/groceries',
          urgency: 'ambient',
        }),
      ],
      isLoading: false,
    });
    setup();

    expect(screen.getByText('Marcus')).toBeInTheDocument();
    expect(screen.getByText('birthday today')).toBeInTheDocument();
    expect(screen.getByText('9 items to pick up')).toBeInTheDocument();
    expect(screen.getByText('6 at Costco, 3 at H-E-B')).toBeInTheDocument();
  });

  it('links each line to the app that owns it', () => {
    useToday.mockReturnValue({ items: [item()], isLoading: false });
    setup();

    expect(screen.getByTestId('today-item-event')).toHaveAttribute('href', '/events');
  });

  it('shows a skeleton while the lanes are still loading', () => {
    useToday.mockReturnValue({ items: [], isLoading: true });
    setup();

    expect(screen.getByTestId('today-widget-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('today-empty')).not.toBeInTheDocument();
  });

  it('says so plainly when there is nothing on', () => {
    useToday.mockReturnValue({ items: [], isLoading: false });
    setup();

    expect(screen.getByTestId('today-empty')).toBeInTheDocument();
    expect(screen.getByText('Nothing on for today')).toBeInTheDocument();
  });

  it('renders an item with no detail without an empty second line', () => {
    useToday.mockReturnValue({
      items: [item({ detail: undefined })],
      isLoading: false,
    });
    setup();

    expect(screen.queryByText('birthday today')).not.toBeInTheDocument();
    expect(screen.getByText('Marcus')).toBeInTheDocument();
  });
});
