/**
 * Tests for `<SchemaForm>`: generation from a resource schema, the sparse
 * `fields` override diff, schema-derived validation, server-error mapping, and
 * the payload handed to `onSubmit`.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SchemaForm } from '../SchemaForm';
import type { FieldWidgetProps } from '../types';
import type { ResourceDefinition } from '../../../resources/types';

const def: ResourceDefinition = {
  singular: 'widget',
  plural: 'widgets',
  fields: {
    name: { type: 'string', required: true },
    amount: { type: 'number', required: true, minimum: 0 },
    code: { type: 'string', pattern: '^[0-9]{4}$' },
    kind: { type: 'string', enum: ['a', 'b'] },
    notes: { type: 'string' },
    created_by: { type: 'string', reference: { resource: 'user' } },
  },
};

function renderForm(props: Partial<React.ComponentProps<typeof SchemaForm>> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<SchemaForm resource={def} onSubmit={onSubmit} {...props} />);
  return { onSubmit };
}

describe('SchemaForm generation', () => {
  it('renders a labeled control per schema field', () => {
    renderForm();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Kind')).toBeInTheDocument();
  });

  it('auto-hides references to the built-in user root (created_by)', () => {
    renderForm();
    expect(screen.queryByText('Created By')).not.toBeInTheDocument();
  });

  it('renders a select for an enum field with its options', () => {
    renderForm();
    expect(screen.getByRole('option', { name: 'A' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'B' })).toBeInTheDocument();
  });
});

describe('SchemaForm fields diff', () => {
  it('applies a sparse label override', () => {
    renderForm({ fields: { name: { label: 'Full Name' } } });
    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.queryByText('Name')).not.toBeInTheDocument();
  });

  it('hides a field marked hidden', () => {
    renderForm({ fields: { notes: { hidden: true } } });
    expect(screen.queryByText('Notes')).not.toBeInTheDocument();
  });

  it('renders a custom widget override', () => {
    const Custom = (p: FieldWidgetProps) => (
      <div data-testid="custom-notes">custom:{String(p.value)}</div>
    );
    renderForm({ fields: { notes: { widget: Custom } } });
    expect(screen.getByTestId('custom-notes')).toBeInTheDocument();
  });
});

describe('SchemaForm validation', () => {
  it('blocks submit and shows a message when a required field is empty', async () => {
    const { onSubmit } = renderForm();
    fireEvent.submit(screen.getByRole('button', { name: /create/i }).closest('form')!);
    await waitFor(() => expect(screen.getByText('Name is required')).toBeInTheDocument());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('enforces a numeric minimum from the schema', async () => {
    const { onSubmit } = renderForm({ initialData: { name: 'W', amount: -5 } });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(screen.getByText('Amount must be at least 0')).toBeInTheDocument());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('enforces a string pattern only when the optional field is filled', async () => {
    const { onSubmit } = renderForm({ initialData: { name: 'W', amount: 1, code: '12' } });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() =>
      expect(screen.getByText('Code is not in the expected format')).toBeInTheDocument(),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('SchemaForm submit payload', () => {
  it('sends required fields and omits blank optionals', async () => {
    const { onSubmit } = renderForm({ initialData: { name: 'Widget A', amount: 12 } });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Widget A', amount: 12 });
  });

  it('maps an engine constraint error back onto the field', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(new Error('field "amount" must be <= 100'));
    render(<SchemaForm resource={def} onSubmit={onSubmit} initialData={{ name: 'W', amount: 12 }} />);
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() =>
      expect(screen.getByText('field "amount" must be <= 100')).toBeInTheDocument(),
    );
  });
});
