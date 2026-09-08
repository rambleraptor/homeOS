import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CelebrationToast } from '../CelebrationToast';

describe('CelebrationToast', () => {
  it('shows the title and description', () => {
    render(
      <CelebrationToast
        title="Aldi complete!"
        description="Every item checked off — nice work!"
      />,
    );

    expect(screen.getByText('Aldi complete!')).toBeInTheDocument();
    expect(screen.getByText('Every item checked off — nice work!')).toBeInTheDocument();
  });

  it('renders only the title when there is no description', () => {
    render(<CelebrationToast title="Done!" />);

    expect(screen.getByText('Done!')).toBeInTheDocument();
    expect(screen.getByTestId('celebration-toast').querySelectorAll('p')).toHaveLength(1);
  });
});

/**
 * Through the real toaster: sonner treats custom JSX as unstyled, and the
 * shared `Toaster` scopes its own surface classes to styled toasts, so the
 * card must be the only box on screen — otherwise it would sit on a white,
 * shadowed rectangle that shows at its rounded corners.
 */
describe('useToast().celebrate', () => {
  it('renders the card as an unstyled sonner toast', async () => {
    const { ToastProvider, useToast } = await import('../ToastProvider');

    function Harness() {
      const toast = useToast();
      return (
        <button onClick={() => toast.celebrate('Aldi complete!', { description: 'Nice work!' })}>
          celebrate
        </button>
      );
    }

    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'celebrate' }));

    const card = await screen.findByTestId('celebration-toast');
    const toastItem = card.closest('[data-sonner-toast]');
    expect(toastItem).not.toBeNull();
    expect(toastItem).toHaveAttribute('data-styled', 'false');
    expect(toastItem).toHaveClass('w-full');
    expect(screen.getByText('Aldi complete!')).toBeInTheDocument();
  });
});
