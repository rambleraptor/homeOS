/**
 * Documents home: upload a file, watch it get read, browse what came back.
 */

import { useMemo, useRef, useState } from 'react';
import { Loader2, Upload, AlertCircle, Shield } from 'lucide-react';
import { PageHeader } from '@rambleraptor/homestead-core/shared/components/PageHeader';
import { useDocuments } from '../hooks/useDocuments';
import { useUploadDocument } from '../hooks/useUploadDocument';
import { RedactionEditor } from '../redaction/RedactionEditor';
import { useDeleteDocument } from '../hooks/useUpdateDocument';
import { usePeople } from '../../people/hooks/usePeople';
import { findDuplicateUploads } from '../duplicates';
import { DocumentListItem } from './DocumentListItem';
import { DocumentFilters } from './DocumentFilters';
import { DuplicateUploadWarning } from './DuplicateUploadWarning';
import {
  collectDocTypeFacets,
  collectPeople,
  collectTagFacets,
  EMPTY_FILTERS,
  filterDocuments,
  hasActiveFilters,
  type DocumentFilters as Filters,
} from '../filtering';

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,image/gif';

export function DocumentsHome() {
  const inputRef = useRef<HTMLInputElement>(null);
  const redactInputRef = useRef<HTMLInputElement>(null);
  const [redactTarget, setRedactTarget] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  // Ids from the most recent upload batch, checked for duplicates once the
  // server stamps their content hash (which arrives on a later list poll).
  // Dismissing or deleting a flagged upload drops it from here.
  const [uploadedIds, setUploadedIds] = useState<string[]>([]);

  const { data: documents, isLoading, isError, error } = useDocuments();
  const upload = useUploadDocument();
  const remove = useDeleteDocument();
  // The people directory resolves extracted names to canonical identities so
  // the person facet follows aliases. Absent (people app disabled / still
  // loading) it's empty, and every name degrades to a by-spelling identity.
  const { data: directory } = usePeople();

  // Facets come from the whole list; the visible rows are what's left after the
  // filters. Both recompute only when the list, directory, or filters change.
  const docTypeFacets = useMemo(
    () => collectDocTypeFacets(documents ?? []),
    [documents],
  );
  const people = useMemo(
    () => collectPeople(documents ?? [], directory ?? []),
    [documents, directory],
  );
  const tagFacets = useMemo(() => collectTagFacets(documents ?? []), [documents]);
  const visibleDocuments = useMemo(
    () => filterDocuments(documents ?? [], filters, directory ?? []),
    [documents, filters, directory],
  );

  // Duplicates among the last batch. Recomputes as the list polls, so a match
  // surfaces as soon as the server-stamped hash lands on the uploaded record.
  const duplicates = useMemo(
    () => findDuplicateUploads(documents ?? [], uploadedIds),
    [documents, uploadedIds],
  );

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadError(null);
    // Sequential: each upload is a multipart POST plus a classify kick-off, and
    // firing a whole folder at once would stampede the AI provider.
    const ids: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const doc = await upload.mutateAsync(file);
        ids.push(doc.id);
      } catch (err) {
        setUploadError(
          `Couldn't upload ${file.name}: ${err instanceof Error ? err.message : 'unknown error'}`,
        );
        break;
      }
    }
    setUploadedIds(ids);
    if (inputRef.current) inputRef.current.value = '';
  };

  // Redaction is a File → File step in front of the *same* upload flow: pick one
  // file, edit it, then upload the flattened result. The plain path above is
  // untouched, so uploading without redacting stays the default.
  const pickRedactTarget = (files: FileList | null) => {
    setUploadError(null);
    const file = files?.[0];
    if (file) setRedactTarget(file);
    if (redactInputRef.current) redactInputRef.current.value = '';
  };

  const handleRedacted = async (redacted: File) => {
    try {
      await upload.mutateAsync(redacted);
      setRedactTarget(null);
    } catch (err) {
      setRedactTarget(null);
      setUploadError(
        `Couldn't upload ${redacted.name}: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }
  };

  const dismissDuplicate = (id: string) =>
    setUploadedIds((ids) => ids.filter((i) => i !== id));

  const deleteDuplicate = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      dismissDuplicate(id);
    } catch (err) {
      setUploadError(
        `Couldn't delete the duplicate: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Documents" subtitle="Upload a document and we'll read it for you" />

      <div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
          data-testid="document-file-input"
        />
        <input
          ref={redactInputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => pickRedactTarget(e.target.files)}
          data-testid="document-redact-input"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            data-testid="document-upload-button"
          >
            {upload.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {upload.isPending ? 'Uploading…' : 'Upload document'}
          </button>
          <button
            type="button"
            onClick={() => redactInputRef.current?.click()}
            disabled={upload.isPending}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            data-testid="document-redact-button"
          >
            <Shield className="h-4 w-4" />
            Redact & upload
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          PDF or image. Multi-page PDFs are fine. Use “Redact &amp; upload” to black out sensitive
          areas before the file leaves your device.
        </p>
      </div>

      {redactTarget && (
        <RedactionEditor
          file={redactTarget}
          onComplete={handleRedacted}
          onCancel={() => setRedactTarget(null)}
        />
      )}

      {uploadError && (
        <div
          className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700"
          data-testid="document-upload-error"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {uploadError}
        </div>
      )}

      <DuplicateUploadWarning
        duplicates={duplicates}
        onDelete={(id) => void deleteDuplicate(id)}
        onDismiss={dismissDuplicate}
        deletingId={remove.isPending ? remove.variables : undefined}
      />

      {isLoading && (
        <div className="flex justify-center py-12" data-testid="documents-loading">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error instanceof Error ? error.message : 'Failed to load documents'}
        </div>
      )}

      {documents && documents.length === 0 && (
        <p className="py-12 text-center text-sm text-gray-500" data-testid="documents-empty">
          No documents yet. Upload one to get started.
        </p>
      )}

      {documents && documents.length > 0 && (
        <>
          <DocumentFilters
            filters={filters}
            onChange={setFilters}
            docTypes={docTypeFacets}
            people={people}
            tags={tagFacets}
          />

          {visibleDocuments.length > 0 ? (
            <div className="space-y-2" data-testid="documents-list">
              {visibleDocuments.map((doc) => (
                <DocumentListItem key={doc.id} document={doc} />
              ))}
            </div>
          ) : (
            <p
              className="py-12 text-center text-sm text-gray-500"
              data-testid="documents-no-matches"
            >
              {hasActiveFilters(filters)
                ? 'No documents match your filters.'
                : 'No documents to show.'}
            </p>
          )}
        </>
      )}
    </div>
  );
}
