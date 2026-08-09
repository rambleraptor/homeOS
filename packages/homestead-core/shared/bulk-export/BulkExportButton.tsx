/**
 * The standardized bulk-export button.
 *
 * Drop it into any app's header. It reads the resource's export formats from the
 * server's discovery endpoint and:
 *   - renders nothing when the resource declares no `bulkExport`;
 *   - downloads immediately when there's a single format (the common case);
 *   - opens a small menu of formats when there's more than one.
 *
 * ```tsx
 * <BulkExportButton plural="people" />
 * ```
 */

import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@rambleraptor/homestead-core/shared/components/Button';
import { useToast } from '@rambleraptor/homestead-core/shared/components/ToastProvider';
import type { BulkExportFormatInfo } from '@rambleraptor/homestead-core/resources/bulk-export/types';
import { useBulkExport, useBulkExportFormats } from './useBulkExport';

export interface BulkExportButtonProps {
  /** Plural of the resource to export, e.g. `people`. */
  plural: string;
  /** Button label. Defaults to `Export`. */
  label?: string;
  /** aepbase list-filter forwarded to the export (e.g. the active list filter). */
  filter?: string;
  /**
   * Explicit record-id allowlist — export exactly these records. Omit (or pass
   * `undefined`) to export everything; pass an empty array to disable the
   * button ("nothing selected").
   */
  ids?: string[];
  /** Override the download filename. */
  filename?: string;
  variant?: 'primary' | 'secondary';
}

export function BulkExportButton({
  plural,
  label = 'Export',
  filter,
  ids,
  filename,
  variant = 'secondary',
}: BulkExportButtonProps) {
  const toast = useToast();
  const formatsQuery = useBulkExportFormats(plural);
  const exporter = useBulkExport(plural);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close the format menu on any outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const formats = formatsQuery.data ?? [];

  // Nothing to offer: the resource doesn't declare bulk export (or is still
  // loading its formats). Render nothing rather than a dead button.
  if (formats.length === 0) return null;

  // A selection was requested but is empty — the button has nothing to export.
  const emptySelection = ids !== undefined && ids.length === 0;
  const disabled = exporter.isPending || emptySelection;

  const runExport = async (format?: BulkExportFormatInfo) => {
    setOpen(false);
    try {
      await exporter.mutateAsync({ format: format?.id, filter, ids, filename });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export failed');
    }
  };

  // Single format: one click downloads it.
  if (formats.length === 1) {
    return (
      <Button
        variant={variant}
        onClick={() => runExport(formats[0])}
        disabled={disabled}
        data-testid="export-button"
      >
        <Download className="w-4 h-4 mr-2" />
        {exporter.isPending ? 'Exporting…' : label}
      </Button>
    );
  }

  // Several formats: a small menu.
  return (
    <div ref={wrapperRef} className="relative inline-block">
      <Button
        variant={variant}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        data-testid="export-button"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download className="w-4 h-4 mr-2" />
        {exporter.isPending ? 'Exporting…' : label}
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-1 min-w-40 rounded-md border border-border bg-popover p-1 shadow-md"
        >
          {formats.map((format) => (
            <button
              key={format.id}
              role="menuitem"
              type="button"
              className="block w-full rounded px-3 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => runExport(format)}
              data-testid={`export-format-${format.id}`}
            >
              {label} as {format.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
