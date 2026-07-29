/**
 * Turn an original file plus per-page redactions into the file to upload.
 *
 * PDFs stay PDFs (rebuilt from flattened rasters — no text layer survives);
 * images become a flattened PNG. Either way the returned File carries only the
 * redacted bytes, so it drops straight into the existing upload flow in place of
 * the original.
 */

import type { NormRect, PageRaster } from './types';
import { flattenImage, flattenPdf } from './flatten';

function isPdf(file: File): boolean {
  return file.type === 'application/pdf';
}

/** Swap a filename's extension, e.g. "scan.webp" → "scan.png". */
function withExtension(name: string, ext: string): string {
  return `${name.replace(/\.[^./]+$/, '')}.${ext}`;
}

export async function buildRedactedFile(
  file: File,
  pages: PageRaster[],
  rectsByPage: NormRect[][],
): Promise<File> {
  if (isPdf(file)) {
    const blob = await flattenPdf(pages, rectsByPage);
    const name = /\.pdf$/i.test(file.name) ? file.name : withExtension(file.name, 'pdf');
    return new File([blob], name, { type: 'application/pdf' });
  }
  const blob = await flattenImage(pages[0], rectsByPage[0] ?? []);
  return new File([blob], withExtension(file.name, 'png'), { type: 'image/png' });
}
