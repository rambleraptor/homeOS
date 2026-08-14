/**
 * Tests for the shared `fileField()` widget: the dropzone, type/size validation,
 * image-thumbnail vs filename-chip preview, remove, and the injectable remote URL.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fileField, type FileFieldOptions } from '../FileField';
import type { FieldWidgetProps } from '../types';

function renderField(options: FileFieldOptions, over: Partial<FieldWidgetProps> = {}) {
  const onChange = vi.fn();
  const Widget = fileField(options);
  const props: FieldWidgetProps = {
    name: 'doc',
    field: { type: 'file' },
    config: { label: 'Document' },
    value: null,
    onChange,
    id: 'doc',
    required: false,
    form: { values: {}, setValue: vi.fn() },
    ...over,
  };
  render(<Widget {...props} />);
  const input = screen.getByLabelText('Document') as HTMLInputElement;
  return { onChange, input };
}

const pngFile = (name = 'a.png') => new File(['x'], name, { type: 'image/png' });
const pdfFile = (name = 'doc.pdf') => new File(['x'], name, { type: 'application/pdf' });

describe('fileField — empty state', () => {
  it('renders the label, browse prompt, and hint', () => {
    renderField({ accept: 'image/*', maxSizeBytes: 5_000_000, hint: 'Max 5MB' });
    expect(screen.getByText('Document')).toBeInTheDocument();
    expect(screen.getByText(/click to browse/i)).toBeInTheDocument();
    expect(screen.getByText('Max 5MB')).toBeInTheDocument();
  });
});

describe('fileField — validation', () => {
  it('rejects an unsupported type inline and does not emit the file', () => {
    const { onChange, input } = renderField({ accept: 'image/*', maxSizeBytes: 5_000_000 });
    fireEvent.change(input, { target: { files: [pdfFile()] } });
    expect(screen.getByText('Unsupported file type.')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('rejects an oversized file inline', () => {
    const { onChange, input } = renderField({ accept: '', maxSizeBytes: 10 });
    fireEvent.change(input, { target: { files: [new File(['x'.repeat(50)], 'big.txt')] } });
    expect(screen.getByText(/must be smaller than/i)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('honors a custom validate override', () => {
    const { onChange, input } = renderField({
      accept: '',
      maxSizeBytes: 5_000_000,
      validate: () => 'nope',
    });
    fireEvent.change(input, { target: { files: [pngFile()] } });
    expect(screen.getByText('nope')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('fileField — preview', () => {
  it('shows an image thumbnail for an image file', () => {
    const { onChange, input } = renderField({ accept: 'image/*', maxSizeBytes: 5_000_000, preview: 'image' });
    fireEvent.change(input, { target: { files: [pngFile()] } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByAltText('Document')).toBeInTheDocument();
  });

  it('shows a filename chip for a non-image file (auto)', () => {
    const { input } = renderField({ accept: 'application/pdf', maxSizeBytes: 5_000_000, preview: 'auto' });
    fireEvent.change(input, { target: { files: [pdfFile('receipt.pdf')] } });
    expect(screen.getByText('receipt.pdf')).toBeInTheDocument();
  });

  it('previews an existing stored file via useRemoteUrl', () => {
    renderField({
      accept: 'image/*',
      maxSizeBytes: 5_000_000,
      preview: 'image',
      useRemoteUrl: () => 'http://example.test/stored.png',
    });
    expect(screen.getByAltText('Document')).toHaveAttribute('src', 'http://example.test/stored.png');
  });
});

describe('fileField — remove', () => {
  it('clears the selection and emits null', async () => {
    const user = userEvent.setup();
    const { onChange, input } = renderField({ accept: 'application/pdf', maxSizeBytes: 5_000_000, preview: 'auto' });
    fireEvent.change(input, { target: { files: [pdfFile('receipt.pdf')] } });
    expect(screen.getByText('receipt.pdf')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove file' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.queryByText('receipt.pdf')).not.toBeInTheDocument();
  });
});
