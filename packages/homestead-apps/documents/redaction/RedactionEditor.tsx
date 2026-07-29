/**
 * Full-screen redaction editor: open a document, paint opaque rectangles over
 * sensitive regions, and hand back a flattened File. It knows nothing about
 * upload — `onComplete` receives the redacted File and the caller decides what
 * to do with it, so the same editor can front any upload flow.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@rambleraptor/homestead-core/shared/components/Button';
import { loadPages } from './render';
import { buildRedactedFile } from './redact';
import { clampRect, isDrawable, rectFromPoints, type Point } from './geometry';
import type { NormRect, PageRaster } from './types';

interface RedactionEditorProps {
  file: File;
  onComplete: (redacted: File) => void | Promise<void>;
  onCancel: () => void;
}

const pct = (n: number): string => `${n * 100}%`;

export function RedactionEditor({ file, onComplete, onCancel }: RedactionEditorProps) {
  const [pages, setPages] = useState<PageRaster[] | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [rectsByPage, setRectsByPage] = useState<NormRect[][]>([]);
  const [draft, setDraft] = useState<NormRect | null>(null);
  const [busy, setBusy] = useState(false);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<Point | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setPages(null);
    loadPages(file)
      .then((loaded) => {
        if (cancelled) return;
        setPages(loaded);
        setPreviews(loaded.map((p) => p.canvas.toDataURL('image/png')));
        setRectsByPage(loaded.map(() => []));
        setCurrent(0);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not open this file for redaction');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  const pointToNorm = useCallback((clientX: number, clientY: number): Point => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1),
    };
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (busy) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = pointToNorm(e.clientX, e.clientY);
    setDraft({ ...startRef.current, w: 0, h: 0 });
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return;
    setDraft(clampRect(rectFromPoints(startRef.current, pointToNorm(e.clientX, e.clientY))));
  };

  const onPointerUp = () => {
    const rect = draft;
    startRef.current = null;
    setDraft(null);
    if (!rect || !isDrawable(rect)) return;
    setRectsByPage((prev) => {
      const next = prev.map((r) => r.slice());
      next[current] = [...(next[current] ?? []), rect];
      return next;
    });
  };

  const removeRect = (index: number) => {
    setRectsByPage((prev) => {
      const next = prev.map((r) => r.slice());
      next[current] = (next[current] ?? []).filter((_, i) => i !== index);
      return next;
    });
  };

  const clearPage = () => {
    setRectsByPage((prev) => {
      const next = prev.map((r) => r.slice());
      next[current] = [];
      return next;
    });
  };

  const confirm = async () => {
    if (!pages) return;
    setBusy(true);
    setError(null);
    try {
      await onComplete(await buildRedactedFile(file, pages, rectsByPage));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Redaction failed');
      setBusy(false);
    }
  };

  const pageRects = rectsByPage[current] ?? [];
  const totalRects = rectsByPage.reduce((n, r) => n + r.length, 0);
  const pageCount = pages?.length ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-label="Redact document"
      data-testid="redaction-editor"
    >
      <div className="flex items-center justify-between gap-4 border-b border-gray-700 bg-gray-900 px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">Redact before uploading</p>
          <p className="truncate text-xs text-gray-400">
            Drag to cover sensitive areas. Click a box to remove it. Redacted areas are erased
            before upload.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onCancel}
            disabled={busy}
            data-testid="redaction-cancel"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void confirm()}
            disabled={busy || !pages}
            data-testid="redaction-confirm"
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
              </span>
            ) : (
              `Redact & upload${totalRects > 0 ? ` (${totalRects})` : ''}`
            )}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-auto p-4">
        {error && (
          <div
            className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700"
            data-testid="redaction-error"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {!error && !pages && (
          <div className="flex items-center gap-2 text-white" data-testid="redaction-loading">
            <Loader2 className="h-6 w-6 animate-spin" /> Opening document…
          </div>
        )}

        {!error && pages && previews[current] && (
          <div
            ref={surfaceRef}
            className="relative max-h-full max-w-full touch-none select-none shadow-lg"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            data-testid="redaction-surface"
          >
            <img
              src={previews[current]}
              alt={`Page ${current + 1}`}
              className="max-h-[calc(100vh-9rem)] w-auto max-w-full"
              draggable={false}
            />
            {pageRects.map((r, i) => (
              <div
                key={i}
                className="absolute cursor-pointer bg-black"
                style={{ left: pct(r.x), top: pct(r.y), width: pct(r.w), height: pct(r.h) }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  removeRect(i);
                }}
                data-testid="redaction-rect"
              />
            ))}
            {draft && (
              <div
                className="absolute bg-black/60 outline-dashed outline-2 outline-white"
                style={{
                  left: pct(draft.x),
                  top: pct(draft.y),
                  width: pct(draft.w),
                  height: pct(draft.h),
                }}
              />
            )}
          </div>
        )}
      </div>

      {!error && pages && (
        <div className="flex items-center justify-between gap-4 border-t border-gray-700 bg-gray-900 px-4 py-2 text-white">
          <button
            type="button"
            className="rounded px-3 py-1 text-sm disabled:opacity-40"
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={current === 0 || busy}
            data-testid="redaction-prev-page"
          >
            ← Prev
          </button>
          <span className="text-xs text-gray-300" data-testid="redaction-page-indicator">
            Page {current + 1} of {pageCount}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded px-3 py-1 text-sm text-gray-300 disabled:opacity-40"
              onClick={clearPage}
              disabled={pageRects.length === 0 || busy}
              data-testid="redaction-clear-page"
            >
              Clear page
            </button>
            <button
              type="button"
              className="rounded px-3 py-1 text-sm disabled:opacity-40"
              onClick={() => setCurrent((c) => Math.min(pageCount - 1, c + 1))}
              disabled={current >= pageCount - 1 || busy}
              data-testid="redaction-next-page"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
