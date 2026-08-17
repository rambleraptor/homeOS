/**
 * Tests for `<SwipeRow>`.
 *
 * The interesting behaviour is all in the edges: a short drag must not fire,
 * a vertical drag must be left alone so the list still scrolls, and a row must
 * not drag toward an action it doesn't offer. Those are the ways a swipe list
 * turns from a convenience into something that fights the user.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Check, Trash2 } from 'lucide-react';
import { SwipeRow, type SwipeAction } from '../SwipeRow';

function action(overrides: Partial<SwipeAction> = {}): SwipeAction {
  return {
    label: 'Done',
    icon: Check,
    className: 'bg-green-500 text-white',
    onAction: vi.fn(),
    ...overrides,
  };
}

/** Drive a full pointer gesture across the row. */
function swipe(
  element: HTMLElement,
  { dx, dy = 0 }: { dx: number; dy?: number },
) {
  fireEvent.pointerDown(element, { pointerId: 1, clientX: 0, clientY: 0, button: 0 });
  // Two moves: the first crosses the slop radius and locks direction, the
  // second carries the row the rest of the way — the same shape a real finger
  // produces, and the only way the lock logic is exercised at all.
  fireEvent.pointerMove(element, {
    pointerId: 1,
    clientX: Math.sign(dx) * Math.min(Math.abs(dx), 12),
    clientY: Math.sign(dy) * Math.min(Math.abs(dy), 12),
  });
  fireEvent.pointerMove(element, { pointerId: 1, clientX: dx, clientY: dy });
  fireEvent.pointerUp(element, { pointerId: 1, clientX: dx, clientY: dy });
}

function surface() {
  return screen.getByText('Row content');
}

describe('SwipeRow', () => {
  it('fires the right-swipe action past the threshold', () => {
    const onAction = vi.fn();
    render(
      <SwipeRow swipeRight={action({ onAction })}>
        <div>Row content</div>
      </SwipeRow>,
    );

    swipe(surface(), { dx: 120 });

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('fires the left-swipe action past the threshold', () => {
    const onAction = vi.fn();
    render(
      <SwipeRow swipeLeft={action({ label: 'Delete', icon: Trash2, onAction })}>
        <div>Row content</div>
      </SwipeRow>,
    );

    swipe(surface(), { dx: -120 });

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('springs back without firing on a short drag', () => {
    const onAction = vi.fn();
    render(
      <SwipeRow swipeRight={action({ onAction })}>
        <div>Row content</div>
      </SwipeRow>,
    );

    swipe(surface(), { dx: 30 });

    expect(onAction).not.toHaveBeenCalled();
  });

  it('ignores a mostly-vertical drag so the list still scrolls', () => {
    // The single most important property here: a flick down the page must
    // never be captured as a swipe, however far sideways it wanders.
    const onAction = vi.fn();
    render(
      <SwipeRow swipeRight={action({ onAction })}>
        <div>Row content</div>
      </SwipeRow>,
    );

    swipe(surface(), { dx: 100, dy: 140 });

    expect(onAction).not.toHaveBeenCalled();
  });

  it('does not drag toward an action the row does not offer', () => {
    const onAction = vi.fn();
    render(
      <SwipeRow swipeRight={action({ onAction })}>
        <div>Row content</div>
      </SwipeRow>,
    );

    swipe(surface(), { dx: -120 });

    expect(onAction).not.toHaveBeenCalled();
  });

  it('does nothing when disabled', () => {
    const onAction = vi.fn();
    render(
      <SwipeRow swipeRight={action({ onAction })} disabled>
        <div>Row content</div>
      </SwipeRow>,
    );

    swipe(surface(), { dx: 120 });

    expect(onAction).not.toHaveBeenCalled();
  });

  it('swallows the click a completed swipe leaves behind', () => {
    // Without this, swiping a row whose content is a link would both fire the
    // action and navigate.
    const onClick = vi.fn();
    const onAction = vi.fn();
    render(
      <SwipeRow swipeRight={action({ onAction })}>
        <button onClick={onClick}>Row content</button>
      </SwipeRow>,
    );

    swipe(surface(), { dx: 120 });
    fireEvent.click(surface());

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('leaves an ordinary tap alone', () => {
    const onClick = vi.fn();
    render(
      <SwipeRow swipeRight={action()}>
        <button onClick={onClick}>Row content</button>
      </SwipeRow>,
    );

    fireEvent.pointerDown(surface(), { pointerId: 1, clientX: 0, clientY: 0, button: 0 });
    fireEvent.pointerUp(surface(), { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.click(surface());

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('hides the revealed panel from assistive tech', () => {
    render(
      <SwipeRow swipeRight={action({ label: 'Done' })} data-testid="row">
        <div>Row content</div>
      </SwipeRow>,
    );

    fireEvent.pointerDown(surface(), { pointerId: 1, clientX: 0, clientY: 0, button: 0 });
    fireEvent.pointerMove(surface(), { pointerId: 1, clientX: 12, clientY: 0 });
    fireEvent.pointerMove(surface(), { pointerId: 1, clientX: 90, clientY: 0 });

    const panel = screen.getByText('Done').closest('[aria-hidden="true"]');
    expect(panel).not.toBeNull();
  });

  it('signals commit before release', () => {
    // The scale nudge is what makes releasing a decision rather than a guess,
    // so the committed state has to be observable while still dragging.
    render(
      <SwipeRow swipeRight={action()} data-testid="row">
        <div>Row content</div>
      </SwipeRow>,
    );

    fireEvent.pointerDown(surface(), { pointerId: 1, clientX: 0, clientY: 0, button: 0 });
    fireEvent.pointerMove(surface(), { pointerId: 1, clientX: 12, clientY: 0 });
    fireEvent.pointerMove(surface(), { pointerId: 1, clientX: 40, clientY: 0 });
    expect(screen.getByTestId('row')).not.toHaveAttribute('data-swipe-committed');

    fireEvent.pointerMove(surface(), { pointerId: 1, clientX: 90, clientY: 0 });
    expect(screen.getByTestId('row')).toHaveAttribute('data-swipe-committed');
  });
});
