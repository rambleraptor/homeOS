/**
 * Documents home: drop a file to have it read, then browse and filter what came
 * back.
 */

import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, AlertCircle, FileText } from 'lucide-react';
import { getAepErrorMessage } from '@rambleraptor/homestead-core/api/errorMessage';
import { ConfirmDialog } from '@rambleraptor/homestead-core/shared/components/ConfirmDialog';
import { PageHeader } from '@rambleraptor/homestead-core/shared/components/PageHeader';
import { useToast } from '@rambleraptor/homestead-core/shared/components/ToastProvider';
import { useDocuments } from '../hooks/useDocuments';
import { useUploadDocument } from '../hooks/useUploadDocument';
import { useUploadBundle } from '../hooks/useSplitDocument';
import { RedactionEditor } from '../redaction/RedactionEditor';
import { useDeleteDocument } from '../hooks/useUpdateDocument';
import {
  useCollections,
  useSetDocumentCollections,
  toggleMembership,
} from '../hooks/useCollections';
import { usePeople } from '../../people/hooks/usePeople';
import { findDuplicateUploads } from '../duplicates';
import { getDocType } from '../doc-types/registry';
import { DocumentListItem } from './DocumentListItem';
import { DocumentFilters } from './DocumentFilters';
import { DocumentDropzone } from './DocumentDropzone';
import { DuplicateUploadWarning } from './DuplicateUploadWarning';
import { DocumentsEmptyState, type EmptyReason } from './DocumentsEmptyState';
import { CollectionsBar, UNFILED, type CollectionSelection } from './CollectionsBar';
import type { Document } from '../types';
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
/** The bundle-split path takes a PDF only — a form boundary needs pages to cut. */
const ACCEPT_PDF = 'application/pdf';

type SortKey = 'newest' | 'oldest' | 'title' | 'type';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title', label: 'Name (A–Z)' },
  { value: 'type', label: 'Document type' },
];

function typeLabel(doc: Document): string {
  const id = doc.metadata?.doc_type;
  return (id ? getDocType(id)?.label : undefined) ?? 'Unrecognised document';
}

function sortDocuments(docs: Document[], sort: SortKey): Document[] {
  const copy = [...docs];
  switch (sort) {
    case 'newest':
      return copy.sort((a, b) => (b.create_time ?? '').localeCompare(a.create_time ?? ''));
    case 'oldest':
      return copy.sort((a, b) => (a.create_time ?? '').localeCompare(b.create_time ?? ''));
    case 'title':
      return copy.sort((a, b) =>
        (a.title ?? '').localeCompare(b.title ?? '', undefined, { sensitivity: 'base' }),
      );
    case 'type':
      return copy.sort((a, b) => typeLabel(a).localeCompare(typeLabel(b)));
  }
}

export function DocumentsHome() {
  const inputRef = useRef<HTMLInputElement>(null);
  const redactInputRef = useRef<HTMLInputElement>(null);
  const bundleInputRef = useRef<HTMLInputElement>(null);
  const [redactTarget, setRedactTarget] = useState<File | null>(null);
  // Deletion is the one action here that a toast can't take back — the file
  // bytes are gone and a post-classify hook may hold this id — so it keeps a
  // confirmation. Everything else reports through toasts.
  const [confirmDelete, setConfirmDelete] = useState<Document | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>('newest');
  // Top-level folder scope: null = all, 'unfiled' = no collection, else an id.
  const [collection, setCollection] = useState<CollectionSelection>(null);
  // Ids from the most recent upload batch, checked for duplicates once the
  // server stamps their content hash (which arrives on a later list poll).
  // Dismissing or deleting a flagged upload drops it from here.
  const [uploadedIds, setUploadedIds] = useState<string[]>([]);

  const toast = useToast();
  const { data: documents, isLoading, isError, error } = useDocuments();
  const { data: collections } = useCollections();
  const upload = useUploadDocument();
  const setCollections = useSetDocumentCollections();
  const uploadBundle = useUploadBundle();
  const remove = useDeleteDocument();
  // The people directory resolves extracted names to canonical identities so
  // the person facet follows aliases. Absent (people app disabled / still
  // loading) it's empty, and every name degrades to a by-spelling identity.
  const { data: directory } = usePeople();

  // A real folder is in scope (not "all", not "unfiled") — the only state in
  // which "remove from collection" means anything.
  const inCollection = collection !== null && collection !== UNFILED;
  const activeCollectionName = inCollection
    ? (collections ?? []).find((c) => c.id === collection)?.name
    : undefined;

  // The selected collection scopes everything below it (facets included), so the
  // facet counts and the visible rows both reflect the chosen folder.
  const collectionScoped = useMemo(() => {
    const all = documents ?? [];
    if (collection === null) return all;
    if (collection === UNFILED) {
      return all.filter((d) => (d.collections ?? []).length === 0);
    }
    return all.filter((d) => (d.collections ?? []).includes(collection));
  }, [documents, collection]);

  // Facets come from the scoped list; the visible rows are what's left after the
  // filters. Both recompute only when the list, directory, or filters change.
  const docTypeFacets = useMemo(
    () => collectDocTypeFacets(collectionScoped),
    [collectionScoped],
  );
  const people = useMemo(
    () => collectPeople(collectionScoped, directory ?? []),
    [collectionScoped, directory],
  );
  const tagFacets = useMemo(() => collectTagFacets(collectionScoped), [collectionScoped]);
  const visibleDocuments = useMemo(
    () => filterDocuments(collectionScoped, filters, directory ?? []),
    [collectionScoped, filters, directory],
  );
  const sortedDocuments = useMemo(
    () => sortDocuments(visibleDocuments, sort),
    [visibleDocuments, sort],
  );

  // A small "42 documents · 3 still reading" summary over the list. Counted off
  // the same rows the number beside it counts — the visible ones — so the two
  // halves of one sentence can't disagree ("4 documents · 7 still reading" was
  // reachable when this counted the whole folder and the count beside it
  // counted what survived the filters).
  const stillReading = useMemo(
    () => sortedDocuments.filter((d) => (d.parse_status ?? 'pending') === 'pending').length,
    [sortedDocuments],
  );

  // Why the list below is empty, when it is. Filters win over folder scope:
  // they're what the reader just changed, and clearing them is the fix. With
  // neither a filter nor a folder in play the list can't be empty — every
  // document is in scope — so that branch never renders.
  const emptyReason: EmptyReason = hasActiveFilters(filters)
    ? 'filters'
    : collection === UNFILED
      ? 'unfiled'
      : inCollection
        ? 'collection'
        : 'filters';

  // Duplicates among the last batch. Recomputes as the list polls, so a match
  // surfaces as soon as the server-stamped hash lands on the uploaded record.
  const duplicates = useMemo(
    () => findDuplicateUploads(documents ?? [], uploadedIds),
    [documents, uploadedIds],
  );

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    // Sequential: each upload is a multipart POST plus a classify kick-off, and
    // firing a whole folder at once would stampede the AI provider.
    const ids: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const doc = await upload.mutateAsync(file);
        ids.push(doc.id);
      } catch (err) {
        toast.error(`Couldn't upload ${file.name}. ${getAepErrorMessage(err)}`);
        break;
      }
    }
    setUploadedIds(ids);
    if (inputRef.current) inputRef.current.value = '';
  };

  // Splitting a bundle (a tax return, a batch scan) is its own entry point: it
  // fires the `split` method instead of `classify`, so the plain upload path
  // above is untouched. The constituent forms arrive in the list as they're read.
  const handleBundle = async (files: FileList | null) => {
    const file = files?.[0];
    if (bundleInputRef.current) bundleInputRef.current.value = '';
    if (!file) return;
    try {
      await uploadBundle.mutateAsync(file);
      toast.info(
        `Splitting “${file.name}” into its separate forms — they'll appear below as they're read.`,
      );
    } catch (err) {
      toast.error(`Couldn't upload ${file.name}. ${getAepErrorMessage(err)}`);
    }
  };

  // Redaction is a File → File step in front of the *same* upload flow: pick one
  // file, edit it, then upload the flattened result. The plain path above is
  // untouched, so uploading without redacting stays the default.
  const pickRedactTarget = (files: FileList | null) => {
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
      toast.error(`Couldn't upload ${redacted.name}. ${getAepErrorMessage(err)}`);
    }
  };

  // The redact-then-split outcome: black out the bundle first, then feed the
  // flattened PDF to the split flow instead of the plain upload. Offered only
  // for PDFs (see the editor wiring below) — an image is a single page.
  const handleRedactedSplit = async (redacted: File) => {
    try {
      await uploadBundle.mutateAsync(redacted);
      setRedactTarget(null);
      toast.info(
        `Splitting the redacted “${redacted.name}” into its separate forms — they'll appear ` +
          `below as they're read.`,
      );
    } catch (err) {
      setRedactTarget(null);
      toast.error(`Couldn't upload ${redacted.name}. ${getAepErrorMessage(err)}`);
    }
  };

  const dismissDuplicate = (id: string) =>
    setUploadedIds((ids) => ids.filter((i) => i !== id));

  const deleteDuplicate = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      dismissDuplicate(id);
      toast.success('Duplicate deleted');
    } catch (err) {
      toast.error(err);
    }
  };

  const handleDelete = async (doc: Document) => {
    setConfirmDelete(null);
    try {
      await remove.mutateAsync(doc.id);
      dismissDuplicate(doc.id);
      toast.success(`Deleted “${doc.title || 'Untitled document'}”`);
    } catch (err) {
      toast.error(err);
    }
  };

  /**
   * Take a document out of the folder being viewed — the one action on this
   * page that a toast can genuinely reverse, since it's a patch of an id list
   * and nothing is destroyed. So it goes through without a dialog and offers
   * the way back instead.
   */
  const handleRemoveFromCollection = async (doc: Document) => {
    if (collection === null || collection === UNFILED) return;
    const before = doc.collections ?? [];
    try {
      await setCollections.mutateAsync({
        documentId: doc.id,
        collections: toggleMembership(before, collection, false),
      });
      toast.undo(`Removed from ${activeCollectionName ?? 'the collection'}`, () => {
        void setCollections
          .mutateAsync({ documentId: doc.id, collections: before })
          .catch((err: unknown) => toast.error(err));
      });
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        subtitle="Upload a document and we'll read it for you"
        actions={
          <Link
            to="/documents/types"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-surface-white px-4 py-2 text-sm font-medium text-brand-slate transition-colors hover:bg-bg-pearl"
            data-testid="document-types-link"
          >
            <FileText className="h-4 w-4" />
            Supported types
          </Link>
        }
      />

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
      <input
        ref={bundleInputRef}
        type="file"
        accept={ACCEPT_PDF}
        className="hidden"
        onChange={(e) => void handleBundle(e.target.files)}
        data-testid="document-bundle-input"
      />

      <DocumentDropzone
        onFiles={(files) => void handleFiles(files)}
        onBrowseUpload={() => inputRef.current?.click()}
        onBrowseRedact={() => redactInputRef.current?.click()}
        onBrowseBundle={() => bundleInputRef.current?.click()}
        uploading={upload.isPending}
        bundleBusy={uploadBundle.isPending}
      />

      {documents && (
        <CollectionsBar
          documents={documents}
          selected={collection}
          onSelect={setCollection}
        />
      )}

      {redactTarget && (
        <RedactionEditor
          file={redactTarget}
          onComplete={handleRedacted}
          onSplit={
            redactTarget.type === 'application/pdf' ? handleRedactedSplit : undefined
          }
          onCancel={() => setRedactTarget(null)}
        />
      )}

      <DuplicateUploadWarning
        duplicates={duplicates}
        onDelete={(id) => void deleteDuplicate(id)}
        onDismiss={dismissDuplicate}
        deletingId={remove.isPending ? remove.variables : undefined}
      />

      {isLoading && (
        <div className="flex justify-center py-12" data-testid="documents-loading">
          <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error instanceof Error ? error.message : 'Failed to load documents'}
        </div>
      )}

      {documents && documents.length === 0 && (
        <DocumentsEmptyState reason="library" />
      )}

      {documents && documents.length > 0 && (
        <div className="space-y-3">
          <DocumentFilters
            filters={filters}
            onChange={setFilters}
            docTypes={docTypeFacets}
            people={people}
            tags={tagFacets}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-text-muted" data-testid="documents-summary">
              {sortedDocuments.length}{' '}
              {sortedDocuments.length === 1 ? 'document' : 'documents'}
              {stillReading > 0 && ` · ${stillReading} still reading`}
            </p>
            <div className="flex items-center gap-2">
              <label htmlFor="document-sort" className="text-xs text-text-muted">
                Sort
              </label>
              <select
                id="document-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                data-testid="document-sort"
                className="rounded-lg border border-gray-200 bg-surface-white px-3 py-1.5 text-sm text-brand-slate focus:border-accent-terracotta focus:outline-none focus:ring-2 focus:ring-accent-terracotta/30"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {sortedDocuments.length > 0 ? (
            <div className="space-y-2" data-testid="documents-list">
              {sortedDocuments.map((doc) => (
                <DocumentListItem
                  key={doc.id}
                  document={doc}
                  onDelete={() => setConfirmDelete(doc)}
                  onRemoveFromCollection={
                    inCollection ? () => void handleRemoveFromCollection(doc) : undefined
                  }
                  collectionName={activeCollectionName}
                  disabled={remove.isPending || setCollections.isPending}
                />
              ))}
            </div>
          ) : (
            <DocumentsEmptyState
              reason={emptyReason}
              collectionName={activeCollectionName}
              onClearFilters={() => setFilters({ ...EMPTY_FILTERS })}
              onShowAll={() => setCollection(null)}
            />
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && void handleDelete(confirmDelete)}
        title="Delete document"
        message={
          confirmDelete
            ? `Delete “${confirmDelete.title || 'Untitled document'}”? The file goes with it, ` +
              `and this cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={remove.isPending}
      />
    </div>
  );
}
