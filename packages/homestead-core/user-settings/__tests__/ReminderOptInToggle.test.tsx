/**
 * Tests for the shared reminder opt-in switch.
 *
 * The settings hook is mocked, so what's under test is the switch's own
 * behavior: what it reads as on, what it writes, and that it stays put while a
 * write is in flight.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../hooks/useUserSetting', () => ({ useUserSetting: vi.fn() }));

import { useUserSetting } from '../hooks/useUserSetting';
import { ReminderOptInToggle } from '../components/ReminderOptInToggle';

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

function renderToggle() {
  return render(
    <ReminderOptInToggle
      appId="home"
      settingKey="pickup_reminder"
      offLabel="Remind me the night before"
      onLabel="Reminding me"
      data-testid="home-pickup-reminder-toggle"
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ReminderOptInToggle', () => {
  it('reads an unset preference as off', () => {
    mockSetting(undefined);
    renderToggle();
    const toggle = screen.getByTestId('home-pickup-reminder-toggle');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toHaveTextContent('Remind me the night before');
  });

  it('turns the reminder on', async () => {
    const user = userEvent.setup();
    mockSetting(false);
    renderToggle();

    await user.click(screen.getByTestId('home-pickup-reminder-toggle'));
    await waitFor(() => expect(setValue).toHaveBeenCalledWith(true));
    expect(useUserSetting).toHaveBeenCalledWith('home', 'pickup_reminder');
  });

  it('turns it back off, and says so while on', async () => {
    const user = userEvent.setup();
    mockSetting(true);
    renderToggle();

    const toggle = screen.getByTestId('home-pickup-reminder-toggle');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(toggle).toHaveTextContent('Reminding me');
    await user.click(toggle);
    await waitFor(() => expect(setValue).toHaveBeenCalledWith(false));
  });

  it('is inert while a write is in flight', async () => {
    const user = userEvent.setup();
    mockSetting(false, { isSaving: true });
    renderToggle();

    await user.click(screen.getByTestId('home-pickup-reminder-toggle'));
    expect(setValue).not.toHaveBeenCalled();
  });

  it('reads whichever app and key it is pointed at', () => {
    mockSetting(false);
    render(
      <ReminderOptInToggle
        appId="credit-cards"
        settingKey="perk_reminder"
        offLabel="Remind me"
        onLabel="Reminding me"
      />,
    );
    expect(useUserSetting).toHaveBeenCalledWith('credit-cards', 'perk_reminder');
    // Falls back to a stable default testid when the caller doesn't name one.
    expect(screen.getByTestId('reminder-opt-in-toggle')).toBeInTheDocument();
  });
});
