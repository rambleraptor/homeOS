/**
 * The charitable tab's year handling — the part of the page that decides which
 * number someone reads off it.
 *
 * The receipts hook is mocked rather than the transport: what's under test is
 * how the tab resolves a year and renders it, not how the collection is
 * fetched (that plumbing is the shared `useResourceList`, tested on its own).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import type { CharitableReceipt } from '../charitable/types';

const receipts: CharitableReceipt[] = [
  {
    id: 'a',
    organization: 'Food Bank',
    donation_date: '2025-06-01T00:00:00.000Z',
    gift_type: 'Cash',
    amount: 400,
    value_received: 60,
    status: 'Unclaimed',
    receipt_file: 'ack.pdf',
    created: '',
    updated: '',
  },
  {
    id: 'b',
    organization: 'Shelter',
    donation_date: '2025-09-14T00:00:00.000Z',
    gift_type: 'Goods',
    status: 'Unclaimed',
    description_of_property: '3 bags of clothing',
    created: '',
    updated: '',
  },
  {
    id: 'c',
    organization: 'Library Fund',
    donation_date: '2024-02-02T00:00:00.000Z',
    gift_type: 'Cash',
    amount: 90,
    status: 'Claimed',
    receipt_file: 'ack.pdf',
    created: '',
    updated: '',
  },
];

const useCharitableReceipts = vi.fn();

vi.mock('../charitable/hooks/useCharitableReceipts', () => ({
  useCharitableReceipts: () => useCharitableReceipts(),
}));

// Imported after the mock is registered, so the tab binds to it.
const { CharitableTab } = await import('../charitable/components/CharitableTab');

function renderTab(initialUrl: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialUrl]}>
        <CharitableTab addOpen={false} onOpenAdd={vi.fn()} onCloseAdd={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  // The rows carry an acknowledgment file, so the thumbnails ask for one. The
  // global client mock leaves `download` unresolved; a blob keeps the effect
  // honest without making these tests about file plumbing.
  vi.mocked(aepbase.download).mockResolvedValue(new Blob(['pdf']));
  useCharitableReceipts.mockReturnValue({
    data: receipts,
    isLoading: false,
    isError: false,
    error: null,
  });
});

describe('CharitableTab', () => {
  it('totals the named year, net of what was received in return', () => {
    renderTab('/receipts?tab=charitable&year=2025');

    // 400 given less 60 received; the unvalued bag of clothes adds nothing.
    const kpi = screen.getByTestId('charitable-kpi');
    expect(within(kpi).getByText('$340.00')).toBeInTheDocument();
    expect(within(kpi).getByText(/Across 2 receipts in 2025/)).toBeInTheDocument();
  });

  it('switches year from the URL', () => {
    renderTab('/receipts?tab=charitable&year=2024');

    const kpi = screen.getByTestId('charitable-kpi');
    expect(within(kpi).getByText('$90.00')).toBeInTheDocument();
    expect(within(kpi).getByText(/Across 1 receipt in 2024/)).toBeInTheDocument();
  });

  it('falls back to the most recent year with giving when none is named', () => {
    // The fixtures stop at 2025, and "now" is later than that in CI as much as
    // on a laptop — so an unnamed year must land on 2025, not on an empty page.
    renderTab('/receipts?tab=charitable');

    expect(
      within(screen.getByTestId('charitable-kpi')).getByText('$340.00'),
    ).toBeInTheDocument();
  });

  it('selecting a year in the by-year table moves the whole tab', async () => {
    const user = userEvent.setup();
    renderTab('/receipts?tab=charitable&year=2025');

    await user.click(screen.getByTestId('charitable-year-2024'));

    expect(
      within(screen.getByTestId('charitable-kpi')).getByText('$90.00'),
    ).toBeInTheDocument();
  });

  it('says a gift of goods needs a value instead of counting it as zero', () => {
    renderTab('/receipts?tab=charitable&year=2025');

    expect(screen.getAllByText('Needs a value').length).toBeGreaterThan(0);
  });

  it('lists every year with giving, newest first', () => {
    renderTab('/receipts?tab=charitable&year=2025');

    const rows = within(screen.getByTestId('charitable-year-table')).getAllByRole('row');
    // Header row, then 2025, then 2024.
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent('2025');
    expect(rows[2]).toHaveTextContent('2024');
  });
});
