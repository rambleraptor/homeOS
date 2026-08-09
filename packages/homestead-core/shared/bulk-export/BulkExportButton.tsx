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
  /**
   * aepbase list-filter forwarded to the export. This is also how a record
   * selection travels — pass `selectionFilter(selectedIds)` (an `id in [...]`
   * filter) to export exactly the ticked rows.
   */
  filter?: string;
  /** Values for the resource's declared export options, keyed by option id. */
  options?: Record<string, boolean>;
  /** Disable the button (e.g. a selection with nothing ticked). */
  disabled?: boolean;
  /** Override the download filename. */
  filename?: string;
  variant?: 'primary' | 'secondary';
}

export function BulkExportButton({
  plural,
  label = 'Export',
  filter,
  options,
  disabled = false,
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

  const isDisabled = exporter.isPending || disabled;

  const runExport = async (format?: BulkExportFormatInfo) => {
    setOpen(false);
    try {
      await exporter.mutateAsync({ format: format?.id, filter, options, filename });
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
        disabled={isDisabled}
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
        disabled={isDisabled}
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
