/**
 * Tests for the todo kind marker.
 *
 * The rail replaced a 👪 emoji that only marked one of the two states. What
 * needs guarding is that it marks *both*, that it stays out of the title's own
 * styling, and that it never becomes colour-only information.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TodoRow } from '../components/TodoRow';
import { TODO_KIND_STYLE } from '../kindStyles';
import type { TodoItem, TodoKind } from '../types';

function todo(overrides: Partial<TodoItem> = {}): TodoItem {
  return {
    id: 't1',
    path: 'todos/t1',
    title: 'Take the bins out',
    status: 'pending',
    create_time: '2026-01-01T00:00:00Z',
    update_time: '2026-01-01T00:00:00Z',
    kind: 'family',
    ...overrides,
  } as TodoItem;
}

function renderRow(props: Partial<Parameters<typeof TodoRow>[0]> = {}) {
  return render(
    <MemoryRouter>
      <TodoRow
        todo={todo()}
        variant="active"
        onSetStatus={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('TodoRow kind marker', () => {
  it.each<TodoKind>(['personal', 'family'])(
    'marks a %s todo with its own rail colour',
    (kind) => {
      renderRow({ kindMarker: kind });

      const rail = screen.getByTestId(`todo-row-t1-${kind}`);
      expect(rail).toHaveClass(TODO_KIND_STYLE[kind].rail);
    },
  );

  it('gives the two kinds different colours', () => {
    // The cue is worthless if they ever converge.
    expect(TODO_KIND_STYLE.personal.rail).not.toBe(TODO_KIND_STYLE.family.rail);
  });

  it('never relies on colour alone', () => {
    // A rail with no accessible name would be invisible to a screen reader and
    // ambiguous to anyone who cannot separate the two hues.
    renderRow({ kindMarker: 'family' });

    expect(screen.getByText(TODO_KIND_STYLE.family.label)).toHaveClass('sr-only');
  });

  it('renders no rail when the kind is not being shown', () => {
    // Project views: every row is family, so a rail on every line says nothing.
    renderRow({ kindMarker: undefined });

    expect(screen.queryByTestId('todo-row-t1-family')).toBeNull();
    expect(screen.queryByTestId('todo-row-t1-personal')).toBeNull();
  });

  it('keeps the rail outside the title, so a cancelled row does not strike it', () => {
    renderRow({ todo: todo({ status: 'cancelled' }), kindMarker: 'family', variant: 'active' });

    const rail = screen.getByTestId('todo-row-t1-family');
    const struck = rail.closest('.line-through');
    expect(struck).toBeNull();
  });

  it('drops the emoji it replaced', () => {
    renderRow({ kindMarker: 'family' });

    expect(screen.queryByText(/👪/)).toBeNull();
  });
});
