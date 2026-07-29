/**
 * Flatten redactions into destroyed pixels.
 *
 * The security-critical step: each page is drawn onto a *fresh* canvas and the
 * redaction rectangles are painted as opaque fills, so the covered pixels are
 * overwritten — not merely hidden. The output is exported from that canvas, so
 * nothing under a rectangle survives. PDFs are rebuilt from the flattened page
 * rasters, which also strips the original text/vector layer entirely.
 */

import { PDFDocument } from 'pdf-lib';
import type { NormRect, PageRaster } from './types';
import { clampRect, toPixels } from './geometry';

const REDACTION_FILL = '#000000';

/** Draw a page plus its redactions onto a new canvas, destroying covered pixels. */
function paintRedacted(page: PageRaster, rects: NormRect[]): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = page.width;
  out.height = page.height;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Could not get a 2D canvas context');
  ctx.drawImage(page.canvas, 0, 0);
  ctx.fillStyle = REDACTION_FILL;
  for (const r of rects) {
    const p = toPixels(clampRect(r), page.width, page.height);
    if (p.w > 0 && p.h > 0) ctx.fillRect(p.x, p.y, p.w, p.h);
  }
  return out;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas export failed'))),
      type,
    );
  });
}

/** Flatten a single-page image: redactions burned in, re-encoded as PNG. */
export async function flattenImage(page: PageRaster, rects: NormRect[]): Promise<Blob> {
  return canvasToBlob(paintRedacted(page, rects), 'image/png');
}

/** Rebuild a redacted, text-free PDF from the flattened page rasters. */
export async function flattenPdf(
  pages: PageRaster[],
  rectsByPage: NormRect[][],
): Promise<Blob> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pages.length; i++) {
    const canvas = paintRedacted(pages[i], rectsByPage[i] ?? []);
    const png = await pdf.embedPng(await (await canvasToBlob(canvas, 'image/png')).arrayBuffer());
    const pageDoc = pdf.addPage([png.width, png.height]);
    pageDoc.drawImage(png, { x: 0, y: 0, width: png.width, height: png.height });
  }
  // Copy into a fresh ArrayBuffer-backed view so it's a valid BlobPart under
  // strict lib types (pdf-lib returns Uint8Array<ArrayBufferLike>).
  const bytes = new Uint8Array(await pdf.save());
  return new Blob([bytes], { type: 'application/pdf' });
}
