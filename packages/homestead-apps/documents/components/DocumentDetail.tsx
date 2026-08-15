/**
 * Document detail: the file itself previewed inline alongside everything known
 * about it, plus the actions that act on it — edit its details by hand, re-read
 * it with AI, download the original, split it, or delete it.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Download, Pencil, RefreshCw, Scissors, Trash2 } from 'lucide-react';
import { PageHeader } from '@rambleraptor/homestead-core/shared/components/PageHeader';
import { Badge } from '@rambleraptor/homestead-core/shared/components/Badge';
import { Button } from '@rambleraptor/homestead-core/shared/components/Button';
import { SectionCard } from '@rambleraptor/homestead-core/shared/components/SectionCard';
import { ConfirmDialog } from '@rambleraptor/homestead-core/shared/components/ConfirmDialog';
import { getDocType, getDocTypes } from '../doc-types/registry';
import { useDocument } from '../hooks/useDocument';
import { useClassifyDocument } from '../hooks/useUploadDocument';
import { useSplitDocument } from '../hooks/useSplitDocument';
import { useDeleteDocument, useUpdateDocument } from '../hooks/useUpdateDocument';
import { useDownloadDocument } from '../hooks/useDownloadDocument';
import { DocumentMetadata } from './DocumentMetadata';
import { DocumentEditForm } from './DocumentEditForm';
import { DocumentStatusBadge } from './DocumentStatusBadge';
import { DocumentEncryptionBadge } from './DocumentEncryptionBadge';
import { DocumentViewer } from './DocumentViewer';
import type { Document } from '../types';
import { Spinner, LoadingBlock } from '@rambleraptor/homestead-core/shared/components/Spinner';

interface DocumentDetailProps {
  documentId: string;
}

export function DocumentDetail({ documentId }: DocumentDetailProps) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: doc, isLoading, isError, error } = useDocument(documentId);
  const update = useUpdateDocument();
  const remove = useDeleteDocument();
  const classify = useClassifyDocument();
  const split = useSplitDocument();
  const download = useDownloadDocument();

  const handleSave = async (patch: Partial<Document>) => {
    await update.mutateAsync({ id: documentId, patch });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    await remove.mutateAsync(documentId);
    navigate('/documents');
  };

  const backLink = (
    <Link
      to="/documents"
      className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-brand-slate"
      data-testid="document-detail-back"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to documents
    </Link>
  );

  if (isLoading) {
    return (
      <LoadingBlock size="md" tone="subtle" data-testid="document-detail-loading" />
    );
  }

  if (isError || !doc) {
    return (
      <div className="space-y-4">
        {backLink}
        <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error instanceof Error ? error.message : 'Document not found'}
        </div>
      </div>
    );
  }

  const status = doc.parse_status ?? 'pending';
  const docType = doc.metadata?.doc_type ? getDocType(doc.metadata.doc_type) : undefined;
  const busy = classify.isPending || status === 'pending';

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
              <Button
                variant="secondary"
                onClick={() => download.mutate(doc)}
                disabled={download.isPending}
                data-testid="document-download"
              >
                {download.isPending ? (
                  <Spinner size="sm" tone="inherit" label={null} />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download
              </Button>
              <Button
                variant="secondary"
                onClick={() => setIsEditing(true)}
                data-testid="document-edit"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            </div>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <DocumentStatusBadge status={status} />
        {typeof doc.file_encrypted === 'boolean' && (
          <DocumentEncryptionBadge encrypted={doc.file_encrypted} />
        )}
        {typeof doc.confidence === 'number' && status === 'parsed' && (
          <span className="text-xs text-text-muted" data-testid="document-confidence">
            {Math.round(doc.confidence * 100)}% confidence
          </span>
        )}
      </div>

      {!isEditing && doc.tags && doc.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" data-testid="document-tags">
          {doc.tags.map((tag) => (
            <Badge key={tag} variant="neutral" data-testid={`document-tag-${tag}`}>
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {isEditing ? (
        <div className="rounded-2xl border border-gray-100 bg-surface-white p-5 shadow-sm">
          <DocumentEditForm
            document={doc}
            isSaving={update.isPending}
            onCancel={() => setIsEditing(false)}
            onSubmit={handleSave}
          />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
          {/* Left: the file itself, kept in view while the details scroll. */}
          <div className="lg:sticky lg:top-6">
            <DocumentViewer document={doc} />
          </div>

          {/* Right: parsed fields, extracted text, and the management tools. */}
          <div className="space-y-6">
            <SectionCard title="Details">
              {status === 'pending' ? (
                <p className="text-sm text-text-muted">Still reading this document…</p>
              ) : (
                <DocumentMetadata metadata={doc.metadata} />
              )}
            </SectionCard>

            {(doc.file_text ?? doc.full_text) && (
              <SectionCard title="Extracted text">
                <pre
                  className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-bg-pearl p-3 text-xs text-brand-slate"
                  data-testid="document-full-text"
                >
                  {doc.file_text ?? doc.full_text}
                </pre>
              </SectionCard>
            )}

            <SectionCard title="Manage">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => classify.mutate({ id: documentId })}
                  disabled={busy}
                  data-testid="document-reclassify"
                >
                  <RefreshCw className="h-4 w-4" />
                  Read again with AI
                </Button>

                {/* Force a type: skips the AI's guess and extracts that type's
                    fields directly — for when classification keeps getting it wrong. */}
                <label htmlFor="document-force-type" className="sr-only">
                  Classify as a specific document type
                </label>
                <select
                  id="document-force-type"
                  value=""
                  onChange={(e) => {
                    const forced = e.target.value;
                    if (forced) classify.mutate({ id: documentId, docType: forced });
                  }}
                  disabled={busy}
                  className="rounded-lg border border-gray-200 bg-surface-white px-3 py-1.5 text-sm text-brand-slate focus:border-accent-terracotta focus:outline-none focus:ring-2 focus:ring-accent-terracotta/30 disabled:opacity-50"
                  data-testid="document-force-type"
                  title="Force this document to a specific type, then extract its fields"
                >
                  <option value="">Classify as…</option>
                  {getDocTypes().map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>

                {doc.mime_type === 'application/pdf' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => split.mutate(documentId)}
                    disabled={split.isPending || status === 'pending'}
                    data-testid="document-split"
                    title="Split this PDF into one document per form (e.g. a tax return)"
                  >
                    <Scissors className="h-4 w-4" />
                    Split into forms
                  </Button>
                )}

                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setConfirmDelete(true)}
                  disabled={remove.isPending}
                  data-testid="document-delete"
                  className="ml-auto"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          void handleDelete();
        }}
        title="Delete document"
        message="Delete this document? This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={remove.isPending}
      />
    </div>
  );
}
