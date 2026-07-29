/**
 * buildRedactedFile routing: PDFs are rebuilt as PDFs, images become PNGs, and
 * the returned File carries the flattened bytes — the thing the upload flow gets
 * in place of the original. The pixel-destroying flatten step is mocked here
 * (real canvas is an e2e concern); this locks the type/name/dispatch contract.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../redaction/flatten', () => ({
  flattenImage: vi.fn(async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })),
  flattenPdf: vi.fn(async () => new Blob([new Uint8Array([4, 5, 6])], { type: 'application/pdf' })),
}));

import { buildRedactedFile } from '../redaction/redact';
import { flattenImage, flattenPdf } from '../redaction/flatten';
import type { PageRaster } from '../redaction/types';

const fakePage = (): PageRaster => ({ canvas: {} as HTMLCanvasElement, width: 100, height: 100 });

beforeEach(() => vi.clearAllMocks());

describe('buildRedactedFile', () => {
  it('rebuilds a PDF from the flattened pages and keeps the .pdf name', async () => {
    const file = new File([new Uint8Array([0])], 'taxes.pdf', { type: 'application/pdf' });
    const pages = [fakePage(), fakePage()];
    const rects = [[], [{ x: 0.1, y: 0.1, w: 0.2, h: 0.2 }]];

    const out = await buildRedactedFile(file, pages, rects);

    expect(flattenPdf).toHaveBeenCalledWith(pages, rects);
    expect(flattenImage).not.toHaveBeenCalled();
    expect(out.type).toBe('application/pdf');
    expect(out.name).toBe('taxes.pdf');
  });

  it('flattens an image to PNG and swaps the extension', async () => {
    const file = new File([new Uint8Array([0])], 'card.webp', { type: 'image/webp' });
    const pages = [fakePage()];
    const rects = [[{ x: 0, y: 0, w: 1, h: 0.5 }]];

    const out = await buildRedactedFile(file, pages, rects);

    expect(flattenImage).toHaveBeenCalledWith(pages[0], rects[0]);
    expect(flattenPdf).not.toHaveBeenCalled();
    expect(out.type).toBe('image/png');
    expect(out.name).toBe('card.png');
  });

  it('gives an extension-less PDF a .pdf name', async () => {
    const file = new File([new Uint8Array([0])], 'scan', { type: 'application/pdf' });
    const out = await buildRedactedFile(file, [fakePage()], [[]]);
    expect(out.name).toBe('scan.pdf');
  });
});
