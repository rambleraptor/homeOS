/**
 * Client hooks for the bulk-import API.
 *
 * The browser is a thin client here: it uploads the file, the server parses it,
 * and the preview the user sees is the server's own parse. Both the preview and
 * the import run as AEP-151 operations, so each call is a `202` + a poll.
 *
 * Nothing in here is app-specific — the standardized page drives any resource
 * that declares `bulkImport`.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { awaitOperation } from '@rambleraptor/homestead-core/api/operations';
import type { Operation } from '@rambleraptor/homestead-core/resources/operations';
import type {
  BulkImportFormatInfo,
  BulkImportPreview,
  BulkImportRequest,
  BulkImportResult,
} from '@rambleraptor/homestead-core/resources/bulk-import/types';

const BULK_IMPORT_VERB = 'bulk-import';

/**
 * A preview is work the user is actively waiting on, so poll faster than the
 * 1.5s default — a snappy parse shouldn't feel like a second and a half.
 */
const PREVIEW_POLL_MS = 300;

interface CustomMethodInfo {
  plural: string;
  verb: string;
  bulkImport?: { formats: BulkImportFormatInfo[] };
}

/**
 * The formats a resource accepts, from the server's discovery endpoint.
 *
 * Fetched rather than bundled: parsers are server-only (stubbed out of the
 * browser build), so the client learns what it can upload at runtime. That's
 * what lets one page serve every app with no per-app UI code.
 */
export function useBulkImportFormats(plural: string) {
  return useQuery({
    queryKey: ['bulk-import', 'formats', plural],
    // Formats only change on deploy.
    staleTime: Infinity,
    queryFn: async (): Promise<BulkImportFormatInfo[]> => {
      const res = await fetch('/api/custom-methods');
      if (!res.ok) throw new Error('Could not load import formats');
      const { methods } = (await res.json()) as { methods: CustomMethodInfo[] };
      const method = methods.find(
        (m) => m.plural === plural && m.verb === BULK_IMPORT_VERB,
      );
      return method?.bulkImport?.formats ?? [];
    },
  });
}

/** Base64-encode a file for the JSON request body. */
async function encodeFile(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  // Chunked: spreading a multi-MB array into fromCharCode blows the argument
  // limit.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export interface BulkImportInputPayload {
  format: string;
  files?: File[];
  text?: string;
}

async function buildRequest(
  input: BulkImportInputPayload,
  extra: Partial<BulkImportRequest>,
): Promise<BulkImportRequest> {
  const base: BulkImportRequest = { format: input.format, ...extra };
  if (input.text !== undefined) return { ...base, text: input.text };
  const files = input.files ?? [];
  return {
    ...base,
    data: await Promise.all(files.map(encodeFile)),
    filenames: files.map((f) => f.name),
  };
}

/** Parse without writing, returning the server's candidate items. */
export function useBulkImportPreview(plural: string) {
  return useMutation({
    mutationFn: async (input: BulkImportInputPayload): Promise<BulkImportPreview> => {
      const body = await buildRequest(input, { dryRun: true });
      const operation = await aepbase.customMethod<Operation>(
        plural,
        BULK_IMPORT_VERB,
        body,
      );
      return awaitOperation<BulkImportPreview>(operation.id, {
        intervalMs: PREVIEW_POLL_MS,
      });
    },
  });
}

export interface RunBulkImportInput extends BulkImportInputPayload {
  /**
   * Indices from the preview, or `'*'` for everything importable. The server
   * re-parses the same input rather than trusting client-supplied records, so
   * these address its parse, not ours.
   */
  selectedIndices: number[] | '*';
}

/**
 * Write the selected items. Invalidates `queryKey` on success so the app's list
 * reflects the import without a reload.
 */
export function useBulkImportRun(plural: string, queryKey: readonly unknown[]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RunBulkImportInput): Promise<BulkImportResult> => {
      const body = await buildRequest(input, {
        selectedIndices: input.selectedIndices,
      });
      const operation = await aepbase.customMethod<Operation>(
        plural,
        BULK_IMPORT_VERB,
        body,
      );
      // No intervalMs override: a real import is background work, and the
      // operation stays visible in the (superuser-only) Operations app if the
      // user navigates away mid-import.
      return awaitOperation<BulkImportResult>(operation.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
