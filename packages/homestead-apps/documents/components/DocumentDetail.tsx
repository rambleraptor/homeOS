/**
 * Document detail: everything known about one document, plus the actions that
 * act on it — edit its details by hand, re-read it with AI, download the
 * original file, or delete it.
 *
 * The list page shows only name + type; this is where the parsed fields, the
 * full extracted text, and the raw file live.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Download,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '@rambleraptor/homestead-core/shared/components/PageHeader';
import { getDocType } from '../doc-types/registry';
import { useDocument } from '../hooks/useDocument';
import { useClassifyDocument } from '../hooks/useUploadDocument';
import { useDeleteDocument, useUpdateDocument } from '../hooks/useUpdateDocument';
import { useDownloadDocument } from '../hooks/useDownloadDocument';
import { DocumentMetadata } from './DocumentMetadata';
import { DocumentEditForm } from './DocumentEditForm';
import { DocumentStatusBadge } from './DocumentStatusBadge';
import type { Document } from '../types';

interface DocumentDetailProps {
  documentId: string;
}

export function DocumentDetail({ documentId }: DocumentDetailProps) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);

  const { data: doc, isLoading, isError, error } = useDocument(documentId);
  const update = useUpdateDocument();
  const remove = useDeleteDocument();
  const classify = useClassifyDocument();
  const download = useDownloadDocument();

  const handleSave = async (patch: Partial<Document>) => {
    await update.mutateAsync({ id: documentId, patch });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this document? This cannot be undone.')) return;
    await remove.mutateAsync(documentId);
    navigate('/documents');
  };

  const backLink = (
    <Link
      to="/documents"
      className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      data-testid="document-detail-back"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to documents
    </Link>
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12" data-testid="document-detail-loading">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (isError || !doc) {
    return (
      <div className="space-y-4">
        {backLink}
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error instanceof Error ? error.message : 'Document not found'}
        </div>
      </div>
    );
  }

  const status = doc.parse_status ?? 'pending';
  const docType = doc.metadata?.doc_type ? getDocType(doc.metadata.doc_type) : undefined;

  return (
    <div className="space-y-6" data-testid="document-detail">
      {backLink}

      <PageHeader
        title={doc.title || 'Untitled document'}
        subtitle={
          <span data-testid="document-type">
            {docType?.label ?? 'Unrecognised document'}
          </span>
        }
        actions={
          !isEditing && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => download.mutate(doc)}
                disabled={download.isPending}
                className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                data-testid="document-download"
              >
                {download.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                data-testid="document-edit"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>
            </div>
          )
        }
      />

      <div className="flex items-center gap-3">
        <DocumentStatusBadge status={status} />
        {typeof doc.confidence === 'number' && status === 'parsed' && (
          <span className="text-xs text-gray-500" data-testid="document-confidence">
            {Math.round(doc.confidence * 100)}% confidence
          </span>
        )}
      </div>

      {isEditing ? (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <DocumentEditForm
            document={doc}
            isSaving={update.isPending}
            onCancel={() => setIsEditing(false)}
            onSubmit={handleSave}
          />
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-medium text-gray-900">Details</h2>
            {status === 'pending' ? (
              <p className="text-sm text-gray-500">Still reading this document…</p>
            ) : (
              <DocumentMetadata metadata={doc.metadata} />
            )}
          </div>

          {doc.full_text && (
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-medium text-gray-900">Extracted text</h2>
              <pre
                className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs text-gray-700"
                data-testid="document-full-text"
              >
                {doc.full_text}
              </pre>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => classify.mutate(documentId)}
              disabled={classify.isPending || status === 'pending'}
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
              data-testid="document-reclassify"
            >
              <RefreshCw className="h-4 w-4" />
              Read again with AI
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={remove.isPending}
              className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
              data-testid="document-delete"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
