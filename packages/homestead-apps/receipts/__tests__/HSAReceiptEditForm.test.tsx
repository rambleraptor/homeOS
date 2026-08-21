/**
 * Tests for HSAReceiptEditForm — prefill from an existing receipt and the
 * partial-update payload it emits on submit.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HSAReceiptEditForm } from '../components/HSAReceiptEditForm';
import type { HSAReceipt } from '../types';

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

const receipt: HSAReceipt = {
  id: 'r1',
  merchant: 'Dentist',
  service_date: '2026-03-15T00:00:00Z',
  amount: 120.5,
  category: 'Dental',
  patient: 'Self',
  status: 'Stored',
  notes: 'crown',
  created: '',
  updated: '',
};

describe('HSAReceiptEditForm', () => {
  it('prefills the form from the receipt', () => {
    renderWithClient(
      <HSAReceiptEditForm
        receipt={receipt}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        isSubmitting={false}
      />,
    );
    expect(screen.getByLabelText(/Merchant/i)).toHaveValue('Dentist');
    // A full ISO datetime is narrowed to the date input's YYYY-MM-DD.
    expect(screen.getByLabelText(/Service Date/i)).toHaveValue('2026-03-15');
    expect(screen.getByLabelText(/Amount/i)).toHaveValue(120.5);
    expect(screen.getByLabelText(/Category/i)).toHaveValue('Dental');
    expect(screen.getByLabelText(/Status/i)).toHaveValue('Stored');
    expect(screen.getByLabelText(/Patient/i)).toHaveValue('Self');
  });

  it('submits an edited partial payload', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithClient(
      <HSAReceiptEditForm
        receipt={receipt}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        isSubmitting={false}
      />,
    );

    const merchant = screen.getByLabelText(/Merchant/i);
    await user.clear(merchant);
    await user.type(merchant, 'Ortho');
    await user.selectOptions(screen.getByLabelText(/Status/i), 'Reimbursed');
    await user.click(screen.getByTestId('hsa-receipt-edit-submit'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant: 'Ortho',
        status: 'Reimbursed',
        category: 'Dental',
        amount: 120.5,
      }),
    );
  });

  it('calls onCancel without submitting', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    renderWithClient(
      <HSAReceiptEditForm
        receipt={receipt}
        onSubmit={onSubmit}
        onCancel={onCancel}
        isSubmitting={false}
      />,
    );
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
