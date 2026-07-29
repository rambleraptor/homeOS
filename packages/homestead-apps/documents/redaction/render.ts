/**
 * Rasterize a document to per-page canvases for redaction.
 *
 * Images become a single page; PDFs are rendered page-by-page with pdf.js in
 * worker-less (main-thread) mode. pdf.js v5's main build bundles the worker's
 * message handler, so exposing it as `globalThis.pdfjsWorker` makes the whole
 * engine run on the main thread — no `new Worker`, no CDN, statically bundled.
 * The PDF engine is dynamically imported so it only loads when a PDF is opened.
 */

import type { PageRaster } from './types';

/** 2× oversampling keeps small print legible enough to redact accurately. */
const PDF_RENDER_SCALE = 2;

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

async function loadPdfjs(): Promise<typeof import('pdfjs-dist')> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const [pdfjs, worker] = await Promise.all([
        import('pdfjs-dist'),
        // pdfjs ships no types for the worker entry; v5's main build bundles the
        // handler, so we expose it as `globalThis.pdfjsWorker` and pdf.js runs on
        // the main thread (no Web Worker). Used only as an opaque value.
        // @ts-expect-error untyped module — imported purely for its handler.
        import('pdfjs-dist/build/pdf.worker.mjs'),
      ]);
      (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = {
        WorkerMessageHandler: (worker as { WorkerMessageHandler: unknown }).WorkerMessageHandler,
      };
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf';
}

function newCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get a 2D canvas context');
  return { canvas, ctx };
}

async function renderImage(file: File): Promise<PageRaster[]> {
  const bitmap = await createImageBitmap(file);
  try {
    const { canvas, ctx } = newCanvas(bitmap.width, bitmap.height);
    ctx.drawImage(bitmap, 0, 0);
    return [{ canvas, width: canvas.width, height: canvas.height }];
  } finally {
    bitmap.close();
  }
}

async function renderPdf(file: File): Promise<PageRaster[]> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  try {
    const pages: PageRaster[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
      const { canvas, ctx } = newCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      pages.push({ canvas, width: canvas.width, height: canvas.height });
      page.cleanup();
    }
    return pages;
  } finally {
    await doc.destroy();
  }
}

/** Rasterize every page of a document (image = 1 page, PDF = N pages). */
export async function loadPages(file: File): Promise<PageRaster[]> {
  return isPdf(file) ? renderPdf(file) : renderImage(file);
}
