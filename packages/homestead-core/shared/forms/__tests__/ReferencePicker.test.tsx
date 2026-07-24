import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import {
  initializeAppRegistry,
  resetAppRegistry,
} from '@rambleraptor/homestead-core/apps/registry';
import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';
import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';
import { ReferencePicker } from '../ReferencePicker';

const project: ResourceDefinition = {
  singular: 'project',
  plural: 'projects',
  fields: { name: { type: 'string', required: true } },
};

const transaction: ResourceDefinition = {
  singular: 'transaction',
  plural: 'transactions',
  parents: ['gift-card'],
  fields: { amount: { type: 'number' } },
};

function registerResources(resources: ResourceDefinition[]) {
  const app: AppConfig = { id: 'test', name: 'Test', description: 'x', resources };
  initializeAppRegistry([app]);
}

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  registerResources([project, transaction]);
});

afterEach(() => {
  resetAppRegistry();
});

describe('ReferencePicker', () => {
  it('loads the target collection and renders one option per record', async () => {
    vi.mocked(aepbase.list).mockResolvedValue([
      { id: 'p1', name: 'Kitchen' },
      { id: 'p2', name: 'Garden' },
    ]);

    render(
      <ReferencePicker resource="project" value={undefined} onChange={vi.fn()} testId="pick" />,
      { wrapper: wrapper() },
    );

    await waitFor(() =>
      expect(screen.getByTestId('pick-option-p1')).toBeInTheDocument(),
    );
    expect(aepbase.list).toHaveBeenCalledWith('projects');
    expect(screen.getByTestId('pick-option-p1')).toHaveTextContent('Kitchen');
    expect(screen.getByTestId('pick-option-p2')).toHaveTextContent('Garden');
  });

  it('single-select: picking an option reports its id, re-tapping clears it', async () => {
    const user = userEvent.setup();
    vi.mocked(aepbase.list).mockResolvedValue([{ id: 'p1', name: 'Kitchen' }]);
    const onChange = vi.fn();

    const { rerender } = render(
      <ReferencePicker resource="project" value={undefined} onChange={onChange} testId="pick" />,
      { wrapper: wrapper() },
    );

    await screen.findByTestId('pick-option-p1');
    await user.click(screen.getByTestId('pick-option-p1'));
    expect(onChange).toHaveBeenLastCalledWith('p1');

    rerender(
      <ReferencePicker resource="project" value="p1" onChange={onChange} testId="pick" />,
    );
    await user.click(screen.getByTestId('pick-option-p1'));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it('required single-select does not clear on re-tap', async () => {
    const user = userEvent.setup();
    vi.mocked(aepbase.list).mockResolvedValue([{ id: 'p1', name: 'Kitchen' }]);
    const onChange = vi.fn();

    render(
      <ReferencePicker resource="project" value="p1" required onChange={onChange} testId="pick" />,
      { wrapper: wrapper() },
    );

    await screen.findByTestId('pick-option-p1');
    await user.click(screen.getByTestId('pick-option-p1'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('multiple: toggles ids on and off in the array', async () => {
    const user = userEvent.setup();
    vi.mocked(aepbase.list).mockResolvedValue([
      { id: 'p1', name: 'Kitchen' },
      { id: 'p2', name: 'Garden' },
    ]);
    const onChange = vi.fn();

    render(
      <ReferencePicker
        resource="project"
        value={['p1']}
        multiple
        onChange={onChange}
        testId="pick"
      />,
      { wrapper: wrapper() },
    );

    await screen.findByTestId('pick-option-p2');
    await user.click(screen.getByTestId('pick-option-p2'));
    expect(onChange).toHaveBeenLastCalledWith(['p1', 'p2']);

    await user.click(screen.getByTestId('pick-option-p1'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('filters options by the search box', async () => {
    const user = userEvent.setup();
    vi.mocked(aepbase.list).mockResolvedValue([
      { id: 'p1', name: 'Kitchen' },
      { id: 'p2', name: 'Garden' },
    ]);

    render(
      <ReferencePicker resource="project" value={undefined} onChange={vi.fn()} testId="pick" />,
      { wrapper: wrapper() },
    );

    await screen.findByTestId('pick-option-p1');
    await user.type(screen.getByTestId('pick-search'), 'gard');
    expect(screen.queryByTestId('pick-option-p1')).not.toBeInTheDocument();
    expect(screen.getByTestId('pick-option-p2')).toBeInTheDocument();
  });

  it('degrades to a raw id input for a parent-scoped reference (not listable)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    // A parent-scoped reference can't be listed, so the picker falls back to a
    // controlled text input — drive it through a stateful harness so the typed
    // value round-trips like it would in a real form.
    function Harness() {
      const [v, setV] = React.useState<string | string[] | undefined>(undefined);
      return (
        <ReferencePicker
          resource="transaction"
          value={v}
          onChange={(next) => {
            setV(next);
            onChange(next);
          }}
          testId="pick"
        />
      );
    }

    render(<Harness />, { wrapper: wrapper() });

    const input = await screen.findByTestId('pick-idinput');
    expect(aepbase.list).not.toHaveBeenCalled();
    await user.type(input, 'txn-9');
    expect(onChange).toHaveBeenLastCalledWith('txn-9');
  });

  it('shows an empty state when the collection has no records', async () => {
    vi.mocked(aepbase.list).mockResolvedValue([]);

    render(
      <ReferencePicker resource="project" value={undefined} onChange={vi.fn()} testId="pick" />,
      { wrapper: wrapper() },
    );

    await waitFor(() =>
      expect(screen.getByTestId('pick-empty')).toBeInTheDocument(),
    );
  });
});
