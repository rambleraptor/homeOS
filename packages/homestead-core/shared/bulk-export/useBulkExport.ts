/**
 * Client hooks for the bulk-export API.
 *
 * Export is a plain authenticated GET that streams a file back, so the browser
 * can't just point an `<a href>` at it (the bearer token wouldn't ride along) —
 * it fetches the blob, blob-URLs it, and clicks a throwaway anchor, the same
 * shape the Documents app uses for its file downloads.
 *
 * Nothing in here is app-specific — one button drives any resource that
 * declares `bulkExport`.
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { authStore } from '@rambleraptor/homestead-core/api/aepbase';
import type { BulkExportFormatInfo } from '@rambleraptor/homestead-core/resources/bulk-export/types';

const BULK_EXPORT_VERB = 'bulk-export';
const AEP_BASE = '/api/aep';

interface CustomMethodInfo {
  plural: string;
  verb: string;
  bulkExport?: { formats: BulkExportFormatInfo[] };
}

/**
 * The formats a resource can be exported to, from the server's discovery
 * endpoint. Fetched rather than bundled — serializers are server-only — so one
 * button serves every app with no per-app UI code.
 */
export function useBulkExportFormats(plural: string) {
  return useQuery({
    queryKey: ['bulk-export', 'formats', plural],
    // Formats only change on deploy.
    staleTime: Infinity,
    queryFn: async (): Promise<BulkExportFormatInfo[]> => {
      const res = await fetch('/api/custom-methods');
      if (!res.ok) throw new Error('Could not load export formats');
      const { methods } = (await res.json()) as { methods: CustomMethodInfo[] };
      const method = methods.find(
        (m) => m.plural === plural && m.verb === BULK_EXPORT_VERB,
      );
      return method?.bulkExport?.formats ?? [];
    },
  });
}

export interface BulkExportInput {
  /** Format id to export; defaults to the resource's first declared format. */
  format?: string;
  /** aepbase list-filter passed to the source; omit for everything. */
  filter?: string;
  /**
   * Explicit record-id allowlist — export exactly these records. Omit for all.
   * The server rejects the whole export (400) if any id no longer exists.
   */
  ids?: string[];
  /** Override the download filename; defaults to what the server names it. */
  filename?: string;
}

/** Pull the filename out of a `Content-Disposition: attachment; filename="…"`. */
function filenameFromDisposition(header: string | null): string | undefined {
  if (!header) return undefined;
  const match = /filename="?([^"]+)"?/.exec(header);
  return match?.[1];
}

/**
 * Download the export file for `plural`. Streams the authenticated GET into a
 * blob and saves it to disk under the server-provided filename.
 */
export function useBulkExport(plural: string) {
  return useMutation({
    mutationFn: async (input: BulkExportInput = {}): Promise<void> => {
      const params = new URLSearchParams();
      if (input.format) params.set('format', input.format);
      if (input.filter) params.set('filter', input.filter);
      if (input.ids && input.ids.length > 0) params.set('ids', input.ids.join(','));
      if (input.filename) params.set('filename', input.filename);
      const qs = params.toString();
      const url = `${AEP_BASE}/${plural}:${BULK_EXPORT_VERB}${qs ? `?${qs}` : ''}`;

      const headers: Record<string, string> = {};
      if (authStore.token) headers.Authorization = `Bearer ${authStore.token}`;
      // The gateway authenticates custom methods via bearer + X-User-Id.
      const userId = authStore.model?.id;
      if (userId) headers['X-User-Id'] = userId;

      const res = await fetch(url, { headers });
      if (!res.ok) {
        let message = `Export failed (HTTP ${res.status})`;
        try {
          const body = (await res.json()) as { message?: string };
          if (body?.message) message = body.message;
        } catch {
          // Non-JSON error body — keep the status message.
        }
        throw new Error(message);
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      try {
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download =
          input.filename ??
          filenameFromDisposition(res.headers.get('Content-Disposition')) ??
          `${plural}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    },
  });
}
