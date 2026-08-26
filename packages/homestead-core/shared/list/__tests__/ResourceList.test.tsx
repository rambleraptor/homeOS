/**
 * Container behaviour only: which slot renders, and when a page is fetched.
 * Styling is the app's, so there is nothing here about markup.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { aepbase } from '../../../api/aepbase';
import { ResourceList } from '../ResourceList';
import { usePaginatedResource } from '../usePaginatedResource';

interface Row {
  id: string;
  title: string;
}

function pageOf(ids: string[], nextPageToken?: string) {
  return { results: ids.map((id) => ({ id, title: `Row ${id}` })), nextPageToken };
}

function Harness({ mode = 'append' as const }: { mode?: 'append' | 'pages' }) {
  const source = usePaginatedResource<Row>('demo', 'row', 'rows', { pageSize: 2, mode });
  return (
    <ResourceList
      source={source}
      loading={<p>loading…</p>}
      empty={<p>nothing here</p>}
      error={(err, retry) => (
        <button onClick={retry} type="button">
          failed: {err.message}
        </button>
      )}
      more={({ loadMore, next, prev, pageIndex }) => (
        <div>
          <button type="button" onClick={mode === 'pages' ? next : loadMore}>
            more
          </button>
          <button type="button" onClick={prev}>
            back
          </button>
          <span>page {pageIndex}</span>
        </div>
      )}
    >
      {(rows) => (
        <ul>
          {rows.map((r) => (
            <li key={r.id}>{r.title}</li>
          ))}
        </ul>
      )}
    </ResourceList>
  );
}

function renderHarness(mode: 'append' | 'pages' = 'append') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Harness mode={mode} />
    </QueryClientProvider>,
  );
}

describe('ResourceList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the empty slot only once the first page has landed', async () => {
    vi.mocked(aepbase.page).mockResolvedValue(pageOf([]));
    renderHarness();

    expect(screen.getByText('loading…')).toBeInTheDocument();
    expect(screen.queryByText('nothing here')).not.toBeInTheDocument();
    expect(await screen.findByText('nothing here')).toBeInTheDocument();
  });

  it('appends the next page and drops the more slot at the end', async () => {
    vi.mocked(aepbase.page)
      .mockResolvedValueOnce(pageOf(['1', '2'], 'cursor-2'))
      .mockResolvedValueOnce(pageOf(['3']));
    renderHarness();

    expect(await screen.findByText('Row 1')).toBeInTheDocument();
    expect(screen.queryByText('Row 3')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'more' }));

    expect(await screen.findByText('Row 3')).toBeInTheDocument();
    expect(screen.getByText('Row 1')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'more' })).not.toBeInTheDocument(),
    );
  });

  it('shows one page at a time in pages mode, and steps back without refetching', async () => {
    vi.mocked(aepbase.page)
      .mockResolvedValueOnce(pageOf(['1', '2'], 'cursor-2'))
      .mockResolvedValueOnce(pageOf(['3', '4'], 'cursor-3'));
    renderHarness('pages');

    expect(await screen.findByText('Row 1')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'more' }));
    expect(await screen.findByText('Row 3')).toBeInTheDocument();
    expect(screen.queryByText('Row 1')).not.toBeInTheDocument();
    expect(screen.getByText('page 1')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'back' }));
    expect(await screen.findByText('Row 1')).toBeInTheDocument();
    expect(aepbase.page).toHaveBeenCalledTimes(2);
  });

  it('hands the error slot a retry that refetches from page one', async () => {
    vi.mocked(aepbase.page)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(pageOf(['1']));
    renderHarness();

    const retry = await screen.findByRole('button', { name: /failed: boom/ });
    await userEvent.click(retry);
    expect(await screen.findByText('Row 1')).toBeInTheDocument();
  });
});
