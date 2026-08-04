/**
 * Pure planning helpers for the bundle `split` method — no I/O, no server
 * imports, so they unit-test in isolation (see `__tests__/split-plan.test.ts`).
 * The method (`split.ts`) owns the vision call, the PDF cut, and the writes.
 */

/**
 * One document the model located inside the bundle — its page range and a short
 * label.
 */
export interface DetectedSegment {
  /** 1-based first page (inclusive). */
  start_page: number;
  /** 1-based last page (inclusive). */
  end_page: number;
  /** Short human label, or null when the model couldn't name it. */
  title?: string | null;
}

/** A validated, page-clamped segment ready to cut. Page numbers are 1-based. */
export interface PlannedSegment {
  startPage: number;
  endPage: number;
  /** 0-based page indices for pdf-lib's `copyPages`. */
  pageIndices: number[];
  title: string;
}

/**
 * Turn the model's raw page ranges into ordered, in-bounds segments ready to
 * cut.
 *
 * The model is trusted for *where* the boundaries fall but not for staying in
 * bounds: each range is clamped to `[1, pageCount]`, reversed ranges are
 * righted, and non-numeric ranges are dropped. Segments are returned in page
 * order. Overlap is left as-is (rare, and the worst case is a duplicated page in
 * two children, which the user can delete) — clamping only guards against
 * out-of-range indices, which would crash the cut.
 */
export function planSegments(
  raw: DetectedSegment[],
  pageCount: number,
): PlannedSegment[] {
  if (pageCount <= 0) return [];
  const planned: PlannedSegment[] = [];
  for (const seg of raw) {
    const start = Math.round(seg.start_page);
    const end = Math.round(seg.end_page);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    const lo = Math.max(1, Math.min(pageCount, Math.min(start, end)));
    const hi = Math.max(1, Math.min(pageCount, Math.max(start, end)));
    const pageIndices: number[] = [];
    for (let p = lo; p <= hi; p++) pageIndices.push(p - 1);
    planned.push({
      startPage: lo,
      endPage: hi,
      pageIndices,
      title: (seg.title ?? '').trim() || `Pages ${lo}–${hi}`,
    });
  }
  planned.sort((a, b) => a.startPage - b.startPage || a.endPage - b.endPage);
  return planned;
}

/** Pull a four-digit year out of the model's free-text answer, or null. */
export function normalizeTaxYear(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = String(raw).match(/\d{4}/);
  return match ? match[0] : null;
}

/**
 * The tag that groups a split bundle's pieces (and the bundle itself) in the
 * list. Keyed on the tax year when known so a household's returns stay in
 * separate buckets year over year; a generic bucket otherwise.
 */
export function groupTag(year: string | null): string {
  return year ? `tax-return-${year}` : 'tax-return';
}

/** A filesystem-ish name for a child piece, derived from its title. */
export function childFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'document'}.pdf`;
}
