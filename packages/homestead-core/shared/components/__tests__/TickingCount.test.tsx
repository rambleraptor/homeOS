/**
 * The tick has to fire on a change and only on a change: a page that ticks
 * every count on first paint says "these all just moved" when nothing did, and
 * one that re-ticks on an unrelated re-render says it again every poll.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TickingCount } from '../TickingCount';

function count(): HTMLElement {
  return screen.getByTestId('count');
}

describe('TickingCount', () => {
  it('renders the value', () => {
    render(<TickingCount value={7} data-testid="count" />);
    expect(count()).toHaveTextContent('7');
  });

  it('does not tick on first render', () => {
    render(<TickingCount value={3} data-testid="count" />);
    expect(count()).not.toHaveAttribute('data-ticking');
    expect(count().className).not.toContain('animate-count-tick');
  });

  it('ticks when the value changes', () => {
    const { rerender } = render(<TickingCount value={3} data-testid="count" />);
    rerender(<TickingCount value={4} data-testid="count" />);

    expect(count()).toHaveTextContent('4');
    expect(count()).toHaveAttribute('data-ticking', 'true');
    expect(count().className).toContain('animate-count-tick');
  });

  it('keeps the tick on while the same value re-renders', () => {
    const { rerender } = render(<TickingCount value={3} data-testid="count" />);
    rerender(<TickingCount value={4} data-testid="count" />);
    // A poll that returns the same list, or a parent's unrelated state change.
    rerender(<TickingCount value={4} data-testid="count" />);

    // Stripping the class here would cut a running animation off mid-flight.
    expect(count().className).toContain('animate-count-tick');
  });

  it('ticks again when the value returns to an earlier one', () => {
    const { rerender } = render(<TickingCount value={3} data-testid="count" />);
    rerender(<TickingCount value={4} data-testid="count" />);
    rerender(<TickingCount value={3} data-testid="count" />);

    expect(count()).toHaveTextContent('3');
    expect(count().className).toContain('animate-count-tick');
  });
});
