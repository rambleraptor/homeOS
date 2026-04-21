import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HandForm } from '../components/HandForm';

describe('HandForm', () => {
  it('renders level, suit, and direction button rows', () => {
    render(<HandForm onSubmit={() => {}} />);
    expect(screen.getByTestId('level-1')).toBeInTheDocument();
    expect(screen.getByTestId('level-7')).toBeInTheDocument();
    expect(screen.getByTestId('suit-clubs')).toBeInTheDocument();
    expect(screen.getByTestId('suit-no-trump')).toBeInTheDocument();
    expect(screen.getByTestId('direction-north')).toBeInTheDocument();
    expect(screen.getByTestId('direction-east')).toBeInTheDocument();
    expect(screen.getByTestId('direction-south')).toBeInTheDocument();
    expect(screen.getByTestId('direction-west')).toBeInTheDocument();
  });

  it('commits the active level + suit to the tapped direction', async () => {
    const user = userEvent.setup();
    render(<HandForm onSubmit={() => {}} />);

    await user.click(screen.getByTestId('level-3'));
    await user.click(screen.getByTestId('suit-spades'));
    await user.click(screen.getByTestId('direction-north'));

    expect(screen.getByTestId('direction-north-bid')).toHaveTextContent('3♠');
    expect(screen.getByTestId('direction-north')).toBeDisabled();
    expect(screen.getByTestId('direction-east')).not.toBeDisabled();
  });

  it('submits all four bids once every direction is entered', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<HandForm onSubmit={onSubmit} />);

    await user.click(screen.getByTestId('level-3'));
    await user.click(screen.getByTestId('suit-spades'));
    await user.click(screen.getByTestId('direction-north'));

    await user.click(screen.getByTestId('level-4'));
    await user.click(screen.getByTestId('suit-no-trump'));
    await user.click(screen.getByTestId('direction-east'));

    await user.click(screen.getByTestId('level-2'));
    await user.click(screen.getByTestId('suit-hearts'));
    await user.click(screen.getByTestId('direction-south'));

    expect(onSubmit).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('level-7'));
    await user.click(screen.getByTestId('suit-diamonds'));
    await user.click(screen.getByTestId('direction-west'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      north_level: 3,
      north_suit: 'spades',
      east_level: 4,
      east_suit: 'no-trump',
      south_level: 2,
      south_suit: 'hearts',
      west_level: 7,
      west_suit: 'diamonds',
    });
  });

  it('resets the direction buttons after submission', async () => {
    const user = userEvent.setup();
    render(<HandForm onSubmit={() => {}} />);

    for (const dir of ['north', 'east', 'south', 'west'] as const) {
      await user.click(screen.getByTestId(`direction-${dir}`));
    }

    expect(screen.getByTestId('direction-north')).not.toBeDisabled();
    expect(screen.getByTestId('direction-east')).not.toBeDisabled();
    expect(screen.getByTestId('direction-south')).not.toBeDisabled();
    expect(screen.getByTestId('direction-west')).not.toBeDisabled();
    expect(screen.queryByTestId('direction-north-bid')).toBeNull();
  });

  it('ignores repeat taps on an already-entered direction', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<HandForm onSubmit={onSubmit} />);

    await user.click(screen.getByTestId('level-3'));
    await user.click(screen.getByTestId('suit-spades'));
    await user.click(screen.getByTestId('direction-north'));

    await user.click(screen.getByTestId('level-5'));
    await user.click(screen.getByTestId('suit-hearts'));
    await user.click(screen.getByTestId('direction-north'));

    expect(screen.getByTestId('direction-north-bid')).toHaveTextContent('3♠');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables every direction while submitting', () => {
    render(<HandForm onSubmit={() => {}} isSubmitting />);
    expect(screen.getByTestId('direction-north')).toBeDisabled();
    expect(screen.getByTestId('direction-east')).toBeDisabled();
    expect(screen.getByTestId('direction-south')).toBeDisabled();
    expect(screen.getByTestId('direction-west')).toBeDisabled();
  });
});
