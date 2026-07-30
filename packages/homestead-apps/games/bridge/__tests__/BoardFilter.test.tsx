import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BoardFilter } from '../components/BoardFilter';

describe('BoardFilter', () => {
  it('renders a pill per board and marks the selected one', () => {
    render(<BoardFilter boards={[1, 5, 9]} selected={5} onSelect={() => {}} />);

    expect(screen.getByTestId('board-filter-1')).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByTestId('board-filter-5')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByTestId('board-filter-9')).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('reports the picked board', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<BoardFilter boards={[1, 5, 9]} selected={1} onSelect={onSelect} />);

    await user.click(screen.getByTestId('board-filter-9'));

    expect(onSelect).toHaveBeenCalledWith(9);
  });

  it('labels the legacy "no board" bucket', () => {
    render(<BoardFilter boards={[null]} selected={null} onSelect={() => {}} />);
    expect(screen.getByTestId('board-filter-none')).toHaveTextContent('No board');
  });

  it('renders nothing when there are no boards', () => {
    const { container } = render(
      <BoardFilter boards={[]} selected={null} onSelect={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
