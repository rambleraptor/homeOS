import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner, LoadingBlock } from '../Spinner';

describe('Spinner', () => {
  it('always spins', () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector('svg')).toHaveClass('animate-spin');
  });

  it('defaults to the brand tone at medium size', () => {
    const { container } = render(<Spinner />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('text-accent-terracotta', 'w-6', 'h-6');
  });

  it.each([
    ['xs', 'w-3'],
    ['sm', 'w-4'],
    ['md', 'w-6'],
    ['lg', 'w-8'],
    ['xl', 'w-12'],
  ] as const)('renders %s at %s', (size, expected) => {
    const { container } = render(<Spinner size={size} />);
    expect(container.querySelector('svg')).toHaveClass(expected);
  });

  it.each([
    ['brand', 'text-accent-terracotta'],
    ['muted', 'text-text-muted'],
    ['subtle', 'text-gray-400'],
    ['inverse', 'text-white'],
  ] as const)('maps the %s tone to %s', (tone, expected) => {
    const { container } = render(<Spinner tone={tone} />);
    expect(container.querySelector('svg')).toHaveClass(expected);
  });

  it('emits no colour class for the inherit tone, so currentColor wins', () => {
    const { container } = render(<Spinner tone="inherit" />);
    const className = container.querySelector('svg')?.getAttribute('class') ?? '';
    expect(className).not.toMatch(/text-/);
  });

  it('exposes a default status role for screen readers', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toHaveAccessibleName('Loading');
  });

  it('accepts a custom label', () => {
    render(<Spinner label="Saving receipt" />);
    expect(screen.getByRole('status')).toHaveAccessibleName('Saving receipt');
  });

  it('hides itself when label is null, so adjacent text is not double-announced', () => {
    const { container } = render(<Spinner label={null} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('lets className override size and tone via tailwind-merge', () => {
    const { container } = render(
      <Spinner size="lg" tone="brand" className="w-2 h-2 text-red-500" />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('w-2', 'h-2', 'text-red-500');
    expect(svg).not.toHaveClass('w-8', 'h-8', 'text-accent-terracotta');
  });
});

describe('LoadingBlock', () => {
  it('centres a large brand spinner by default', () => {
    const { container } = render(<LoadingBlock />);
    const wrapper = container.firstElementChild;
    expect(wrapper).toHaveClass('flex', 'items-center', 'justify-center');
    expect(container.querySelector('svg')).toHaveClass('w-8', 'text-accent-terracotta');
  });

  it('merges className into the wrapper rather than the icon', () => {
    const { container } = render(<LoadingBlock className="h-64" />);
    expect(container.firstElementChild).toHaveClass('h-64');
    expect(container.querySelector('svg')).not.toHaveClass('h-64');
  });

  it('stays announceable', () => {
    render(<LoadingBlock />);
    expect(screen.getByRole('status')).toHaveAccessibleName('Loading');
  });
});
