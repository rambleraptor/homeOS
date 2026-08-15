import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Inbox } from 'lucide-react';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders the title', () => {
    render(<EmptyState title="No recipes yet" />);
    expect(screen.getByText('No recipes yet')).toBeInTheDocument();
  });

  it('renders an optional description', () => {
    render(
      <EmptyState title="No recipes yet" description="Add your first one." />,
    );
    expect(screen.getByText('Add your first one.')).toBeInTheDocument();
  });

  it('omits the description element entirely when not supplied', () => {
    const { container } = render(<EmptyState title="No recipes yet" />);
    expect(container.querySelectorAll('p')).toHaveLength(1);
  });

  it('accepts nodes in the description, so call sites can link out', () => {
    render(
      <EmptyState
        title="No home documents yet"
        description={<span>Upload one in <a href="/documents">Documents</a>.</span>}
      />,
    );
    expect(screen.getByRole('link', { name: 'Documents' })).toBeInTheDocument();
  });

  it('renders the icon as decorative', () => {
    const { container } = render(<EmptyState icon={Inbox} title="Empty" />);
    const chip = container.querySelector('[aria-hidden="true"]');
    expect(chip).toBeInTheDocument();
    expect(chip?.querySelector('svg')).toBeInTheDocument();
  });

  it('renders no icon chip when no icon is given', () => {
    const { container } = render(<EmptyState title="Empty" />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('renders an action when supplied', () => {
    render(
      <EmptyState title="Empty" action={<button type="button">Add one</button>} />,
    );
    expect(screen.getByRole('button', { name: 'Add one' })).toBeInTheDocument();
  });

  it('uses dashed panel chrome by default', () => {
    const { container } = render(<EmptyState title="Empty" />);
    expect(container.firstElementChild).toHaveClass('border-dashed');
  });

  it('drops the chrome for the plain variant', () => {
    const { container } = render(<EmptyState title="Empty" variant="plain" />);
    const root = container.firstElementChild;
    expect(root).not.toHaveClass('border-dashed');
    expect(root).toHaveClass('text-center');
  });

  it('forwards a test id', () => {
    render(<EmptyState title="Empty" data-testid="recipes-empty-state" />);
    expect(screen.getByTestId('recipes-empty-state')).toBeInTheDocument();
  });
});
