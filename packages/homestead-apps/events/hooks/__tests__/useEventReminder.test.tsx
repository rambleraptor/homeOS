/**
 * useEventReminder maps a four-way UI choice onto the stored `event-reminder`
 * record: create when none exists, update when one does, delete on `none`, and
 * no-op when already off. Every write is scoped to the current user's subtree.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { useEventReminder } from '../useEventReminder';
import type { EventReminder } from '../../types';

const PARENT = { parent: ['users', 'u1'] };

function wrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function freshClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function seed(reminders: EventReminder[]) {
  vi.mocked(aepbase.getCurrentUser).mockReturnValue({ id: 'u1' } as never);
  vi.mocked(aepbase.list).mockResolvedValue(reminders as never);
  vi.mocked(aepbase.create).mockResolvedValue({} as never);
  vi.mocked(aepbase.update).mockResolvedValue({} as never);
  vi.mocked(aepbase.remove).mockResolvedValue(undefined as never);
}

async function renderReady(eventId: string) {
  const client = freshClient();
  const { result } = renderHook(() => useEventReminder(eventId), {
    wrapper: wrapper(client),
  });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useEventReminder', () => {
  it('creates a record when none exists', async () => {
    seed([]);
    const result = await renderReady('e1');
    expect(result.current.choice).toBe('none');

    await act(async () => {
      await result.current.setChoice('day_of');
    });

    expect(aepbase.create).toHaveBeenCalledWith(
      'event-reminders',
      { event_id: 'e1', lead: 'day_of' },
      PARENT,
    );
    expect(aepbase.update).not.toHaveBeenCalled();
    expect(aepbase.remove).not.toHaveBeenCalled();
  });

  it('updates the existing record when switching lead', async () => {
    seed([{ id: 'r1', event_id: 'e1', lead: 'day_of' }]);
    const result = await renderReady('e1');
    expect(result.current.choice).toBe('day_of');

    await act(async () => {
      await result.current.setChoice('both');
    });

    expect(aepbase.update).toHaveBeenCalledWith(
      'event-reminders',
      'r1',
      { lead: 'both' },
      PARENT,
    );
    expect(aepbase.create).not.toHaveBeenCalled();
  });

  it('deletes the record when set to none', async () => {
    seed([{ id: 'r1', event_id: 'e1', lead: 'week_before' }]);
    const result = await renderReady('e1');

    await act(async () => {
      await result.current.setChoice('none');
    });

    expect(aepbase.remove).toHaveBeenCalledWith('event-reminders', 'r1', PARENT);
    expect(aepbase.create).not.toHaveBeenCalled();
    expect(aepbase.update).not.toHaveBeenCalled();
  });

  it('is a no-op when set to none with no existing record', async () => {
    seed([]);
    const result = await renderReady('e1');

    await act(async () => {
      await result.current.setChoice('none');
    });

    expect(aepbase.remove).not.toHaveBeenCalled();
    expect(aepbase.create).not.toHaveBeenCalled();
    expect(aepbase.update).not.toHaveBeenCalled();
  });
});
