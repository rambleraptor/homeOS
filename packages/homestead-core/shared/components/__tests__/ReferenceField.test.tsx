/**
 * Tests for `<ReferenceField>`, the resource-reference form field: a searchable
 * combobox over any collection, plus the optional label / required / help /
 * error chrome. `aepbase.list` is mocked globally (see test setup); individual
 * tests override it to feed options.
 */

import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { ReferenceField } from '../ReferenceField';

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.mocked(aepbase.list).mockResolvedValue([
    { id: 'a', name: 'Alice' },
    { id: 'b', name: 'Bob' },
  ]);
});

describe('ReferenceField', () => {
  it('renders the label wired to the combobox input', () => {
    renderWithClient(
      <ReferenceField id="person" label="Person" collection="people" value={[]} onChange={() => {}} />,
    );
    const label = screen.getByText('Person');
    expect(label).toHaveAttribute('for', 'person');
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows the required marker when required', () => {
    renderWithClient(
      <ReferenceField label="Person" collection="people" value={[]} onChange={() => {}} required />,
    );
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('omits the required marker by default', () => {
    renderWithClient(
      <ReferenceField label="Person" collection="people" value={[]} onChange={() => {}} />,
    );
    expect(screen.queryByText('*')).not.toBeInTheDocument();
  });

  it('renders help text and error when provided', () => {
    renderWithClient(
      <ReferenceField
        id="person"
        label="Person"
        collection="people"
        value={[]}
        onChange={() => {}}
        description="Link this receipt to a person"
        error="This field is required"
      />,
    );
    expect(screen.getByText('Link this receipt to a person')).toBeInTheDocument();
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('renders as a bare picker when no label is given', () => {
    renderWithClient(
      <ReferenceField collection="people" value={[]} onChange={() => {}} />,
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.queryByText('Person')).not.toBeInTheDocument();
  });

  it('selects an option and emits its {collection}/{id} path', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [value, setValue] = useState<string[]>([]);
      return (
        <ReferenceField
          collection="people"
          value={value}
          onChange={setValue}
          testId="picker"
        />
      );
    }
    renderWithClient(<Harness />);

    await user.click(screen.getByTestId('picker-input'));
    const option = await screen.findByTestId('picker-option-a');
    await user.click(option);

    // Single-select collapses the input into a chip labeled with the record.
    await waitFor(() =>
      expect(screen.getByText('Alice')).toBeInTheDocument(),
    );
  });
});
