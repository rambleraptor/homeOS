/**
 * Documents home: upload a file, watch it get read, browse what came back.
 */

import { useRef, useState } from 'react';
import { Loader2, Upload, AlertCircle } from 'lucide-react';
import { PageHeader } from '@rambleraptor/homestead-core/shared/components/PageHeader';
import { useDocuments } from '../hooks/useDocuments';
import { useClassifyDocument, useUploadDocument } from '../hooks/useUploadDocument';
import { DocumentCard } from './DocumentCard';

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,image/gif';

export function DocumentsHome() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: documents, isLoading, isError, error } = useDocuments();
  const upload = useUploadDocument();
  const classify = useClassifyDocument();

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadError(null);
    // Sequential: each upload is a multipart POST plus a classify kick-off, and
    // firing a whole folder at once would stampede the AI provider.
    for (const file of Array.from(files)) {
      try {
        await upload.mutateAsync(file);
      } catch (err) {
        setUploadError(
          `Couldn't upload ${file.name}: ${err instanceof Error ? err.message : 'unknown error'}`,
        );
        break;
      }
    }
    if (inputRef.current) inputRef.current.value = '';
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
        <p className="mt-2 text-xs text-gray-500">PDF or image. Multi-page PDFs are fine.</p>
      </div>

      {uploadError && (
        <div
          className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700"
          data-testid="document-upload-error"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {uploadError}
        </div>
      )}

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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid="documents-list">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onReclassify={(id) => classify.mutate(id)}
              isReclassifying={classify.isPending && classify.variables === doc.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
