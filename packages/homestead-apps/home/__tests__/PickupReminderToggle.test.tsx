/**
 * Tests for the pickup-reminder opt-in that sits on the Home page's curb
 * calendar. The settings hook is mocked, so what's under test is the switch's
 * own behavior: what it reads as on, what it writes, and that it stays put while
 * a write is in flight.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@rambleraptor/homestead-core/user-settings', () => ({
  useUserSetting: vi.fn(),
}));

import { useUserSetting } from '@rambleraptor/homestead-core/user-settings';
import { PickupReminderToggle } from '../components/PickupReminderToggle';

const setValue = vi.fn(async () => undefined);

function mockSetting(value: boolean | undefined, extra: Record<string, unknown> = {}) {
  vi.mocked(useUserSetting).mockReturnValue({
    value,
    setValue,
    isLoading: false,
    isSaving: false,
    error: null,
    ...extra,
  } as unknown as ReturnType<typeof useUserSetting>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PickupReminderToggle', () => {
  it('reads an unset preference as off', () => {
    mockSetting(undefined);
    render(<PickupReminderToggle />);
    expect(screen.getByTestId('home-pickup-reminder-toggle')).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('turns the reminder on', async () => {
    const user = userEvent.setup();
    mockSetting(false);
    render(<PickupReminderToggle />);

    await user.click(screen.getByTestId('home-pickup-reminder-toggle'));
    await waitFor(() => expect(setValue).toHaveBeenCalledWith(true));
    expect(useUserSetting).toHaveBeenCalledWith('home', 'pickup_reminder');
  });

  it('turns it back off', async () => {
    const user = userEvent.setup();
    mockSetting(true);
    render(<PickupReminderToggle />);

    const toggle = screen.getByTestId('home-pickup-reminder-toggle');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await user.click(toggle);
    await waitFor(() => expect(setValue).toHaveBeenCalledWith(false));
  });

  it('is inert while a write is in flight', async () => {
    const user = userEvent.setup();
    mockSetting(false, { isSaving: true });
    render(<PickupReminderToggle />);

    await user.click(screen.getByTestId('home-pickup-reminder-toggle'));
    expect(setValue).not.toHaveBeenCalled();
  });
});
