/**
 * Tests for the headless `useSchemaForm` engine: value seeding, live validity,
 * the submit-blocking guarantee, payload building, extra (virtual) fields,
 * cross-field validation, a custom payload builder, and server-error mapping.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSchemaForm } from '../useSchemaForm';
import type { ResourceDefinition } from '../../../resources/types';

const def: ResourceDefinition = {
  singular: 'widget',
  plural: 'widgets',
  fields: {
    name: { type: 'string', required: true },
    amount: { type: 'number', required: true, minimum: 0 },
    notes: { type: 'string' },
    created_by: { type: 'string', reference: { resource: 'user' } },
  },
};

describe('useSchemaForm', () => {
  it('seeds values from initialData and omits auto-hidden fields', () => {
    const { result } = renderHook(() =>
      useSchemaForm({ resource: def, onSubmit: vi.fn(), initialData: { name: 'A', amount: 5 } }),
    );
    expect(result.current.values).toMatchObject({ name: 'A', amount: 5 });
    expect('created_by' in result.current.values).toBe(false);
    expect(result.current.isValid).toBe(true);
  });

  it('reports invalid while a required field is empty', () => {
    const { result } = renderHook(() => useSchemaForm({ resource: def, onSubmit: vi.fn() }));
    expect(result.current.isValid).toBe(false);
    act(() => {
      result.current.setValue('name', 'X');
      result.current.setValue('amount', 3);
    });
    expect(result.current.isValid).toBe(true);
  });

  it('blocks onSubmit while validation fails and surfaces field errors', async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() => useSchemaForm({ resource: def, onSubmit }));
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.errors.name).toMatch(/required/i);
  });

  it('submits an omit-blank-optionals payload when valid', async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useSchemaForm({ resource: def, onSubmit, initialData: { name: 'A', amount: 5 } }),
    );
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(onSubmit).toHaveBeenCalledWith({ name: 'A', amount: 5 });
  });

  it('manages and validates extra (virtual) fields', async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useSchemaForm({
        resource: def,
        onSubmit,
        initialData: { name: 'A', amount: 5 },
        extraFields: { partner: { type: 'string', required: true } },
      }),
    );
    expect(result.current.isValid).toBe(false);
    act(() => result.current.setValue('partner', 'people/p1'));
    expect(result.current.isValid).toBe(true);
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ partner: 'people/p1' }));
  });

  it('applies cross-field validate() and blocks on its errors', async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useSchemaForm({
        resource: def,
        onSubmit,
        initialData: { name: 'A', amount: 5 },
        validate: () => ({ amount: 'over budget' }),
      }),
    );
    expect(result.current.isValid).toBe(false);
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.errors.amount).toBe('over budget');
  });

  it('honors a custom buildPayload', async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useSchemaForm({
        resource: def,
        onSubmit,
        initialData: { name: 'A', amount: 5 },
        buildPayload: (values) => ({ shaped: values.name }),
      }),
    );
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(onSubmit).toHaveBeenCalledWith({ shaped: 'A' });
  });

  it('maps a rejected server error back onto its field', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('field "amount" must be <= 100'));
    const { result } = renderHook(() =>
      useSchemaForm({ resource: def, onSubmit, initialData: { name: 'A', amount: 5 } }),
    );
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(result.current.errors.amount).toBe('field "amount" must be <= 100');
  });
});
