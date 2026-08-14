/**
 * Tests for GiftCardForm component
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GiftCardForm } from '../components/GiftCardForm';
import { ToastProvider } from '@rambleraptor/homestead-core/shared/components/ToastProvider';
import type { GiftCard } from '../types';

// Mock the backend-aware image URL hook so tests don't need a fetch or pb stub.
// The component renders the returned string directly into <img src=>.
vi.mock('../hooks/useGiftCardImageUrl', () => ({
  useGiftCardImageUrl: vi.fn((card, field) => {
    if (!card?.[field]) return null;
    return `http://test.com/${card[field]}`;
  }),
}));

// Helper to render with ToastProvider
const renderWithToast = (ui: React.ReactElement) => {
  return render(<ToastProvider>{ui}</ToastProvider>);
};

describe('GiftCardForm', () => {
  it('should render form fields correctly', () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    renderWithToast(<GiftCardForm onSubmit={onSubmit} onCancel={onCancel} />);

    expect(screen.getByLabelText(/Merchant/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Card Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/PIN/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Notes/i)).toBeInTheDocument();
    expect(screen.getByText('Front Image')).toBeInTheDocument();
    expect(screen.getByText('Back Image')).toBeInTheDocument();
  });

  it('should populate form with initial data', () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const initialData: GiftCard = {
      id: '1',
      path: 'gift-cards/1',
      merchant: 'Amazon',
      card_number: '1234-5678',
      pin: '1234',
      amount: 50.0,
      notes: 'Test notes',
      create_time: '2024-01-01',
      update_time: '2024-01-01',
    };

    renderWithToast(<GiftCardForm onSubmit={onSubmit} onCancel={onCancel} initialData={initialData} />);

    expect(screen.getByLabelText(/Merchant/i)).toHaveValue('Amazon');
    expect(screen.getByLabelText(/Card Number/i)).toHaveValue('1234-5678');
    expect(screen.getByLabelText(/PIN/i)).toHaveValue('1234');
    expect(screen.getByLabelText(/Amount/i)).toHaveValue(50);
    expect(screen.getByLabelText(/Notes/i)).toHaveValue('Test notes');
  });

  it('should submit form with correct data', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    renderWithToast(<GiftCardForm onSubmit={onSubmit} onCancel={onCancel} />);

    await user.type(screen.getByLabelText(/Merchant/i), 'Target');
    await user.type(screen.getByLabelText(/Card Number/i), '9876-5432');
    await user.type(screen.getByLabelText(/PIN/i), '5678');
    await user.type(screen.getByLabelText(/Amount/i), '25.50');
    await user.type(screen.getByLabelText(/Notes/i), 'Gift from mom');

    await user.click(screen.getByRole('button', { name: /Add Card/i }));

    // SchemaForm omits blank optional fields (including unset file fields)
    // rather than sending explicit nulls; buildGiftCardFormData guards each
    // optional the same way, so the resulting FormData is identical.
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        merchant: 'Target',
        card_number: '9876-5432',
        pin: '5678',
        amount: 25.5,
        notes: 'Gift from mom',
      });
    });
  });

  it('should call onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    renderWithToast(<GiftCardForm onSubmit={onSubmit} onCancel={onCancel} />);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' }); // Cancel button has X icon with screen reader label
    await user.click(cancelButton);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should handle file upload for front image', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    renderWithToast(<GiftCardForm onSubmit={onSubmit} onCancel={onCancel} />);

    const file = new File(['image content'], 'front.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Front Image'), file);

    await waitFor(() => {
      expect(screen.getByAltText('Front Image')).toBeInTheDocument();
    });
  });

  it('should handle file upload for back image', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    renderWithToast(<GiftCardForm onSubmit={onSubmit} onCancel={onCancel} />);

    const file = new File(['image content'], 'back.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Back Image'), file);

    await waitFor(() => {
      expect(screen.getByAltText('Back Image')).toBeInTheDocument();
    });
  });

  it('should remove image when trash button is clicked', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    renderWithToast(<GiftCardForm onSubmit={onSubmit} onCancel={onCancel} />);

    const file = new File(['image content'], 'front.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Front Image'), file);
    await waitFor(() => {
      expect(screen.getByAltText('Front Image')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Remove file' }));

    await waitFor(() => {
      expect(screen.queryByAltText('Front Image')).not.toBeInTheDocument();
    });
  });

  it('should show existing images when editing', () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const initialData: GiftCard = {
      id: '1',
      path: 'gift-cards/1',
      merchant: 'Amazon',
      card_number: '1234-5678',
      amount: 50.0,
      front_image: 'front_abc123.png',
      back_image: 'back_def456.png',
      create_time: '2024-01-01',
      update_time: '2024-01-01',
    };

    renderWithToast(<GiftCardForm onSubmit={onSubmit} onCancel={onCancel} initialData={initialData} />);

    expect(screen.getByAltText('Front Image')).toBeInTheDocument();
    expect(screen.getByAltText('Back Image')).toBeInTheDocument();
  });

  it('should disable submit button when submitting', () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    renderWithToast(<GiftCardForm onSubmit={onSubmit} onCancel={onCancel} isSubmitting={true} />);

    const submitButton = screen.getByRole('button', { name: /Saving.../i });
    expect(submitButton).toBeDisabled();
  });
});
