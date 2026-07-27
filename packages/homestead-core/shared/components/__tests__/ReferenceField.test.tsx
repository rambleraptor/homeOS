/**
 * Tests for `<ReferenceField>`, the labeled form-field wrapper around
 * `ReferenceSelect`. The picker itself is covered elsewhere and needs a
 * QueryClient, so it's mocked here — these tests exercise only the chrome the
 * wrapper adds: label, required marker, help text, error, and prop pass-through.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReferenceField } from '../ReferenceField';

vi.mock('../ReferenceSelect', () => ({
  ReferenceSelect: (props: { id?: string; collection: string }) => (
    <div
      data-testid="reference-select"
      data-id={props.id}
      data-collection={props.collection}
    />
  ),
}));

describe('ReferenceField', () => {
  it('renders the label and delegates to ReferenceSelect', () => {
    render(
      <ReferenceField
        id="person"
        label="Person"
        collection="people"
        value={[]}
        onChange={() => {}}
      />,
    );
    const label = screen.getByText('Person');
    expect(label).toHaveAttribute('for', 'person');
    const select = screen.getByTestId('reference-select');
    expect(select).toHaveAttribute('data-id', 'person');
    expect(select).toHaveAttribute('data-collection', 'people');
  });

  it('shows a required marker only when required', () => {
    const { rerender } = render(
      <ReferenceField label="Person" collection="people" value={[]} onChange={() => {}} />,
    );
    expect(screen.queryByText('*')).not.toBeInTheDocument();

    rerender(
      <ReferenceField
        label="Person"
        collection="people"
        value={[]}
        onChange={() => {}}
        required
      />,
    );
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('renders help text and error when provided', () => {
    render(
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
});
