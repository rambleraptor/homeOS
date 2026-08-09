/**
 * Tests for EventForm
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventForm } from '../components/EventForm';
import type { UseQueryResult } from '@tanstack/react-query';
import type { Person } from '../../people/types';

vi.mock('../../people/hooks/usePeople', () => ({
  usePeople: vi.fn(),
}));

import { usePeople } from '../../people/hooks/usePeople';

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

const samplePeople: Person[] = [
  {
    id: 'p1',
    name: 'Alice',
    addresses: [],
    created_by: 'u1',
    created: '',
    updated: '',
  },
  {
    id: 'p2',
    name: 'Bob',
    addresses: [],
    created_by: 'u1',
    created: '',
    updated: '',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(usePeople).mockReturnValue({
    data: samplePeople,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as UseQueryResult<Person[]>);
});

describe('EventForm', () => {
  it('submits a new event with month/day (no year), tag, and people', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    renderWithClient(
      <EventForm onSubmit={onSubmit} onCancel={onCancel} />,
    );

    await user.type(screen.getByTestId('event-form-name'), 'Test Event');
    await user.selectOptions(screen.getByTestId('event-form-month'), '6');
    await user.type(screen.getByTestId('event-form-day'), '20');
    await user.selectOptions(screen.getByTestId('event-form-tag'), 'birthday');
    await user.click(screen.getByTestId('event-form-person-p1'));

    await user.click(screen.getByTestId('event-form-submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Test Event',
      month: 6,
      day: 20,
      tag: 'birthday',
      people: ['people/p1'],
    });
    // Year omitted entirely when left blank on create.
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('year');
  });

  it('includes the year when provided', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithClient(<EventForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByTestId('event-form-name'), 'Birthday');
    await user.selectOptions(screen.getByTestId('event-form-month'), '6');
    await user.type(screen.getByTestId('event-form-day'), '20');
    await user.type(screen.getByTestId('event-form-year'), '1985');
    await user.click(screen.getByTestId('event-form-submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      month: 6,
      day: 20,
      year: 1985,
    });
  });

  it('clears the year on edit when the field is emptied', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithClient(
      <EventForm
        initialData={{ id: 'e1', name: 'X', month: 6, day: 20, year: 1985 }}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    await user.clear(screen.getByTestId('event-form-year'));
    await user.click(screen.getByTestId('event-form-submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    // Null (not undefined) so the merge-patch drops the stored year.
    expect(onSubmit.mock.calls[0][0].year).toBeNull();
  });

  it('supports a custom tag entered free-form', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithClient(
      <EventForm onSubmit={onSubmit} onCancel={vi.fn()} />,
    );

    await user.type(screen.getByTestId('event-form-name'), 'Graduation');
    await user.selectOptions(screen.getByTestId('event-form-month'), '5');
    await user.type(screen.getByTestId('event-form-day'), '30');
    await user.selectOptions(
      screen.getByTestId('event-form-tag'),
      '__custom__',
    );
    await user.type(
      screen.getByTestId('event-form-tag-custom'),
      'graduation',
    );
    await user.click(screen.getByTestId('event-form-submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      tag: 'graduation',
    });
  });

  it('hydrates from initialData (month/day/year + tag + people)', async () => {
    const onSubmit = vi.fn();
    renderWithClient(
      <EventForm
        initialData={{
          id: 'e1',
          name: 'Existing',
          month: 6,
          day: 20,
          year: 1990,
          tag: 'anniversary',
          people: ['people/p2'],
        }}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByTestId('event-form-name')).toHaveValue('Existing');
    expect(screen.getByTestId('event-form-month')).toHaveValue('6');
    expect(screen.getByTestId('event-form-day')).toHaveValue(20);
    expect(screen.getByTestId('event-form-year')).toHaveValue(1990);
    expect(screen.getByTestId('event-form-tag')).toHaveValue('anniversary');
    expect(
      screen.getByTestId('event-form-person-p2'),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByTestId('event-form-person-p1'),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('omits recurrence fields for the default yearly fixed-date submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithClient(<EventForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByTestId('event-form-name'), 'Birthday');
    await user.selectOptions(screen.getByTestId('event-form-month'), '6');
    await user.type(screen.getByTestId('event-form-day'), '20');
    await user.click(screen.getByTestId('event-form-submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.recurrence).toBeUndefined();
    expect(payload.recurrence_rule).toBeUndefined();
  });

  it('submits an Nth-weekday rule, auto-filling the weekday when a year is given', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithClient(<EventForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByTestId('event-form-name'), "Mother's Day");
    // May 10 2026 is the 2nd Sunday — with the year, auto-fills to 2:0.
    await user.selectOptions(screen.getByTestId('event-form-month'), '5');
    await user.type(screen.getByTestId('event-form-day'), '10');
    await user.type(screen.getByTestId('event-form-year'), '2026');
    await user.selectOptions(
      screen.getByTestId('event-form-recurrence'),
      'yearly-nth-weekday',
    );

    expect(screen.getByTestId('event-form-recurrence-week')).toHaveValue('2');
    expect(screen.getByTestId('event-form-recurrence-weekday')).toHaveValue(
      '0',
    );

    await user.click(screen.getByTestId('event-form-submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: "Mother's Day",
      month: 5,
      day: 10,
      year: 2026,
      recurrence: 'yearly-nth-weekday',
      recurrence_rule: '2:0',
    });
  });

  it('hydrates an existing yearly-nth-weekday event into the recurrence selects', () => {
    renderWithClient(
      <EventForm
        initialData={{
          id: 'e2',
          name: 'Family reunion',
          month: 7,
          day: 1,
          recurrence: 'yearly-nth-weekday',
          recurrence_rule: '-1:6',
        }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByTestId('event-form-recurrence')).toHaveValue(
      'yearly-nth-weekday',
    );
    expect(screen.getByTestId('event-form-recurrence-week')).toHaveValue('-1');
    expect(screen.getByTestId('event-form-recurrence-weekday')).toHaveValue(
      '6',
    );
  });
});
