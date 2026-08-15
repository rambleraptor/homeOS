/**
 * A document's preview URL must carry the file's real MIME type. The engine's
 * `:download` answers `application/octet-stream` for every file field, and a
 * blob URL labelled that way is an unknown download to the browser — the PDF
 * iframe in `DocumentViewer` then navigates the page to a download prompt
 * instead of rendering (the failure mode people hit on phones).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { useDocumentFileUrl } from '../hooks/useDocumentFileUrl';
import type { Document } from '../types';

const doc = (overrides: Partial<Document> = {}): Document =>
  ({
    id: 'doc-1',
    path: 'documents/doc-1',
    file: 'http://server/documents/doc-1:download?field=file',
    mime_type: 'application/pdf',
    ...overrides,
  }) as Document;

let created: Blob[];

beforeEach(() => {
  vi.clearAllMocks();
  created = [];
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
    created.push(blob as Blob);
    return `blob:${created.length}`;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.mocked(aepbase.download).mockResolvedValue(
    new Blob(['%PDF-1.4'], { type: 'application/octet-stream' }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useDocumentFileUrl', () => {
  it('re-labels the downloaded bytes with the document’s stored MIME type', async () => {
    const { result } = renderHook(() => useDocumentFileUrl(doc()));

    await waitFor(() => expect(result.current).toBe('blob:1'));
    expect(created).toHaveLength(1);
    expect(created[0]!.type).toBe('application/pdf');
  });

  it('keeps images typed too, so a new tab renders instead of downloading', async () => {
    const { result } = renderHook(() =>
      useDocumentFileUrl(doc({ mime_type: 'image/png' })),
    );

    await waitFor(() => expect(result.current).toBe('blob:1'));
    expect(created[0]!.type).toBe('image/png');
  });

  it('falls back to the served bytes when the type is unknown', async () => {
    const { result } = renderHook(() =>
      useDocumentFileUrl(doc({ mime_type: undefined })),
    );

    await waitFor(() => expect(result.current).toBe('blob:1'));
    expect(created[0]!.type).toBe('application/octet-stream');
  });

  it('returns null until a document with a file is available', () => {
    const { result } = renderHook(() => useDocumentFileUrl(doc({ file: undefined })));

    expect(result.current).toBeNull();
    expect(aepbase.download).not.toHaveBeenCalled();
  });
});
