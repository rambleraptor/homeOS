/**
 * Tests for the `<Skeleton>` family.
 *
 * The behaviour worth pinning down is the accessibility contract: a loading
 * state made of a dozen empty divs is noise to a screen reader unless the
 * blocks are hidden and the group announces itself exactly once.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Skeleton,
  SkeletonRegion,
  SkeletonText,
  SkeletonList,
  SkeletonCards,
  SkeletonPage,
} from '../Skeleton';

describe('Skeleton', () => {
  it('hides the placeholder block from assistive tech', () => {
    const { container } = render(<Skeleton className="h-4 w-full" />);

    const block = container.firstElementChild;
    expect(block).toHaveAttribute('aria-hidden', 'true');
  });

  it('merges caller classes with the base styles', () => {
    const { container } = render(<Skeleton className="h-10 w-10" />);

    const block = container.firstElementChild;
    expect(block).toHaveClass('animate-pulse', 'h-10', 'w-10');
  });
});

describe('SkeletonRegion', () => {
  it('announces the label once as a polite busy status', () => {
    render(
      <SkeletonRegion label="Loading recipes">
        <Skeleton className="h-4" />
      </SkeletonRegion>,
    );

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Loading recipes')).toHaveClass('sr-only');
  });
});

describe('SkeletonText', () => {
  it('renders the requested number of lines', () => {
    const { container } = render(<SkeletonText lines={4} />);

    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(4);
  });

  it('shortens the last line so the block reads as prose', () => {
    const { container } = render(<SkeletonText lines={3} />);

    const lines = container.querySelectorAll('[aria-hidden="true"]');
    expect(lines[0]).toHaveClass('w-full');
    expect(lines[2]).toHaveClass('w-2/3');
  });
});

describe('SkeletonList', () => {
  it('renders one row per requested item', () => {
    render(<SkeletonList rows={5} data-testid="rows" />);

    const rows = screen.getByTestId('rows');
    expect(rows.querySelectorAll('.flex.items-center')).toHaveLength(5);
  });

  it('omits the leading block unless asked for it', () => {
    const { container } = render(
      <SkeletonList rows={2} data-testid="plain" />,
    );

    // One block per row, and no leading square alongside it.
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
  });

  it('adds a leading block per row when the list has icons', () => {
    const { container } = render(
      <SkeletonList rows={2} showLeading data-testid="with-icons" />,
    );

    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(4);
  });

  it('keeps row widths stable across re-renders', () => {
    const { container, rerender } = render(
      <SkeletonList rows={4} data-testid="stable" />,
    );
    const before = [...container.querySelectorAll('[aria-hidden="true"]')].map(
      (el) => el.className,
    );

    rerender(<SkeletonList rows={4} data-testid="stable" />);
    const after = [...container.querySelectorAll('[aria-hidden="true"]')].map(
      (el) => el.className,
    );

    expect(after).toEqual(before);
  });
});

describe('SkeletonCards', () => {
  it('renders the requested number of cards', () => {
    render(<SkeletonCards count={3} data-testid="cards" />);

    const grid = screen.getByTestId('cards');
    expect(grid.querySelectorAll('.rounded-2xl')).toHaveLength(3);
  });

  it('labels the grid for screen readers', () => {
    render(<SkeletonCards count={2} label="Loading cards" data-testid="cards" />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Loading cards')).toHaveClass('sr-only');
  });
});

describe('SkeletonPage', () => {
  it('stands in for the page header so the frame stays put', () => {
    render(<SkeletonPage body="none" data-testid="page" />);

    // Title + subtitle + actions.
    const page = screen.getByTestId('page');
    expect(page.querySelectorAll('[aria-hidden="true"]')).toHaveLength(3);
  });

  it('omits the header when the page renders one separately', () => {
    render(<SkeletonPage body="none" showHeader={false} data-testid="page" />);

    const page = screen.getByTestId('page');
    expect(page.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
  });

  it('draws a card body at the requested count', () => {
    render(<SkeletonPage body="cards" bodyCount={4} data-testid="page" />);

    expect(screen.getByTestId('page').querySelectorAll('.rounded-2xl')).toHaveLength(4);
  });

  it('draws a list body at the requested count', () => {
    render(<SkeletonPage body="list" bodyCount={5} data-testid="page" />);

    const rows = screen.getByTestId('page').querySelectorAll('.flex.items-center.gap-3');
    expect(rows).toHaveLength(5);
  });

  it('announces the page load exactly once', () => {
    // The composites render bare shapes internally precisely so a page-level
    // skeleton doesn't nest live regions and announce the same load twice.
    render(<SkeletonPage body="cards" label="Loading recipes" data-testid="page" />);

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByText('Loading recipes')).toBeInTheDocument();
  });
});
