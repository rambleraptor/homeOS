/**
 * The documents index filter bar. Presentational — driven by props, reports
 * changes through onChange — so it's tested directly without a data layer.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocumentFilters } from '../components/DocumentFilters';
import { EMPTY_FILTERS, type DocumentFilters as Filters } from '../filtering';

const docTypes = [
  { value: 'form-w2', label: 'Form W-2' },
  { value: 'medical-receipt', label: 'Medical receipt' },
];
const people = [
  { value: 'name:alex stephen', label: 'Alex Stephen' },
  { value: 'person:p1', label: 'Jane Doe' },
];
const tags = ['reimburse', 'taxes'];

function setup(filters: Filters = EMPTY_FILTERS) {
  const onChange = vi.fn();
  render(
    <DocumentFilters
      filters={filters}
      onChange={onChange}
      docTypes={docTypes}
      people={people}
      tags={tags}
    />,
  );
  return { onChange };
}

describe('DocumentFilters', () => {
  it('renders a type option per facet and a person option per name', () => {
    setup();
    expect(screen.getByRole('option', { name: 'Form W-2' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Medical receipt' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Alex Stephen' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Jane Doe' })).toBeInTheDocument();
  });

  it('reports search input through onChange', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.type(screen.getByTestId('document-search'), 'a');
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, search: 'a' });
  });

  it('reports a chosen document type', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.selectOptions(screen.getByTestId('document-type-filter'), 'form-w2');
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, docType: 'form-w2' });
  });

  it('reports a chosen person by identity key, not label', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    // The option's value is the identity key; the label is only what's shown.
    await user.selectOptions(screen.getByTestId('document-person-filter'), 'person:p1');
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, person: 'person:p1' });
  });

  it('renders a tag option per facet and reports a chosen tag', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    expect(screen.getByRole('option', { name: 'taxes' })).toBeInTheDocument();
    await user.selectOptions(screen.getByTestId('document-tag-filter'), 'taxes');
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, tag: 'taxes' });
  });

  it('hides the type, person, and tag selects when there are no facets', () => {
    render(
      <DocumentFilters
        filters={EMPTY_FILTERS}
        onChange={vi.fn()}
        docTypes={[]}
        people={[]}
        tags={[]}
      />,
    );
    expect(screen.queryByTestId('document-type-filter')).not.toBeInTheDocument();
    expect(screen.queryByTestId('document-person-filter')).not.toBeInTheDocument();
    expect(screen.queryByTestId('document-tag-filter')).not.toBeInTheDocument();
  });

  it('hides Clear when no filter is active', () => {
    setup();
    expect(screen.queryByTestId('document-filters-clear')).not.toBeInTheDocument();
  });

  it('shows Clear when a filter is active and resets everything', async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ ...EMPTY_FILTERS, search: 'x', docType: 'form-w2' });
    await user.click(screen.getByTestId('document-filters-clear'));
    expect(onChange).toHaveBeenCalledWith(EMPTY_FILTERS);
  });
});
