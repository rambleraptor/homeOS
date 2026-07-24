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
import type { FieldDef, ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';
import { ResourceForm, buildResourceRequestBody } from '../ResourceForm';

const project: ResourceDefinition = {
  singular: 'project',
  plural: 'projects',
  fields: { name: { type: 'string', required: true } },
};

// A todo-shaped fields map exercising text / enum / boolean / reference.
const todoFields: Record<string, FieldDef> = {
  title: { type: 'string', description: 'Todo title.', required: true },
  status: {
    type: 'string',
    enum: ['pending', 'in_progress', 'completed'],
    required: true,
  },
  created_by: { type: 'string', reference: { resource: 'user' } },
  project: { type: 'string', reference: { resource: 'project' } },
  in_main: { type: 'boolean' },
};

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  const app: AppConfig = {
    id: 'test',
    name: 'Test',
    description: 'x',
    resources: [project],
  };
  initializeAppRegistry([app]);
  vi.mocked(aepbase.list).mockResolvedValue([]);
});

afterEach(() => {
  resetAppRegistry();
});

describe('ResourceForm', () => {
  it('renders a control per renderable field, excluding the excluded ones', async () => {
    render(
      <ResourceForm fields={todoFields} exclude={['created_by']} onSubmit={vi.fn()} />,
      { wrapper: wrapper() },
    );

    expect(screen.getByTestId('resource-form-title')).toBeInTheDocument();
    expect(screen.getByTestId('resource-form-status')).toBeInTheDocument();
    expect(screen.getByTestId('resource-form-in_main')).toBeInTheDocument();
    // Excluded field is absent.
    expect(screen.queryByTestId('resource-form-created_by')).not.toBeInTheDocument();
    // Reference field mounts its picker (empty collection -> empty state).
    await waitFor(() =>
      expect(screen.getByTestId('resource-form-project-empty')).toBeInTheDocument(),
    );
  });

  it('blocks submit and shows errors when a required field is empty', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <ResourceForm fields={todoFields} exclude={['created_by', 'project']} onSubmit={onSubmit} />,
      { wrapper: wrapper() },
    );

    await user.click(screen.getByTestId('resource-form-submit'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Title is required.')).toBeInTheDocument();
    expect(screen.getByText('Status is required.')).toBeInTheDocument();
  });

  it('submits the collected values once required fields are filled', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <ResourceForm fields={todoFields} exclude={['created_by', 'project']} onSubmit={onSubmit} />,
      { wrapper: wrapper() },
    );

    await user.type(screen.getByTestId('resource-form-title'), 'Buy milk');
    await user.selectOptions(screen.getByTestId('resource-form-status'), 'pending');
    await user.click(screen.getByTestId('resource-form-in_main'));
    await user.click(screen.getByTestId('resource-form-submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Buy milk',
      status: 'pending',
      in_main: true,
    });
  });

  it('seeds initial values in edit mode', async () => {
    render(
      <ResourceForm
        fields={todoFields}
        exclude={['created_by', 'project']}
        initialValues={{ title: 'Existing', status: 'completed' }}
        onSubmit={vi.fn()}
      />,
      { wrapper: wrapper() },
    );

    expect(screen.getByTestId('resource-form-title')).toHaveValue('Existing');
    expect(screen.getByTestId('resource-form-status')).toHaveValue('completed');
  });

  it('applies a declared default when no initial value is given', async () => {
    const fields: Record<string, FieldDef> = {
      title: { type: 'string', required: true },
      status: { type: 'string', enum: ['a', 'b'], default: 'b' },
    };
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<ResourceForm fields={fields} onSubmit={onSubmit} />, { wrapper: wrapper() });

    expect(screen.getByTestId('resource-form-status')).toHaveValue('b');
    await user.type(screen.getByTestId('resource-form-title'), 'x');
    await user.click(screen.getByTestId('resource-form-submit'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ title: 'x', status: 'b' }));
  });

  it('calls onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ResourceForm fields={todoFields} exclude={['created_by', 'project']} onSubmit={vi.fn()} onCancel={onCancel} />,
      { wrapper: wrapper() },
    );
    await user.click(screen.getByTestId('resource-form-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('buildResourceRequestBody', () => {
  it('returns a plain object and drops undefined values when no files are present', () => {
    const body = buildResourceRequestBody({ a: '1', b: undefined, c: ['x', 'y'] });
    expect(body).toEqual({ a: '1', c: ['x', 'y'] });
    expect(body).not.toBeInstanceOf(FormData);
  });

  it('returns FormData when a File is present, repeating array keys', () => {
    const file = new File(['data'], 'photo.png', { type: 'image/png' });
    const body = buildResourceRequestBody({
      merchant: 'Acme',
      tags: ['a', 'b'],
      front_image: file,
      skip: undefined,
    });
    expect(body).toBeInstanceOf(FormData);
    const fd = body as FormData;
    expect(fd.get('merchant')).toBe('Acme');
    expect(fd.getAll('tags')).toEqual(['a', 'b']);
    expect(fd.get('front_image')).toBeInstanceOf(File);
    expect(fd.has('skip')).toBe(false);
  });
});
