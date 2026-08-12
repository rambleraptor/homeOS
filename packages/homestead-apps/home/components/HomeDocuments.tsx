/**
 * The household documents worth having at hand — appliance manuals, warranties,
 * the homeowners policy, the property-tax statement.
 *
 * A read-only view over the Documents app: it reuses the same list query and
 * row component, then narrows to the Home doc types (see `homeDocTypes`).
 * Uploading and reading still happen in Documents; this is the shelf you pull
 * them off of. Rows are grouped by type so a manual doesn't hide among tax
 * statements.
 *
 * Renders as a *section* — `HomePage` owns the page title, so this contributes
 * only its own heading and rows.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, FileText, Loader2 } from 'lucide-react';
import { useDocuments } from '../../documents/hooks/useDocuments';
import { DocumentListItem } from '../../documents/components/DocumentListItem';
import { getDocType } from '../../documents/doc-types/registry';
import type { Document } from '../../documents/types';
import { HOME_DOC_TYPE_IDS, isHomeDocument } from '../homeDocTypes';

/** A type heading plus the documents matched to it, in the allow-list order. */
interface HomeGroup {
  id: string;
  label: string;
  documents: Document[];
}

/**
 * Bucket the home documents by their matched type, preserving
 * `HOME_DOC_TYPE_IDS` order and dropping types with nothing to show. Input is
 * already newest-first (from `useDocuments`), so each group's rows are too.
 */
function groupByType(documents: Document[]): HomeGroup[] {
  return HOME_DOC_TYPE_IDS.map((id) => ({
    id,
    label: getDocType(id)?.label ?? id,
    documents: documents.filter((doc) => doc.metadata?.doc_type === id),
  })).filter((group) => group.documents.length > 0);
}

export function HomeDocuments() {
  const { data: documents, isLoading, isError, error } = useDocuments();

  const groups = useMemo(
    () => groupByType((documents ?? []).filter(isHomeDocument)),
    [documents],
  );
  const total = useMemo(
    () => groups.reduce((sum, group) => sum + group.documents.length, 0),
    [groups],
  );

  return (
    <div className="space-y-6" data-testid="home-documents">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Documents
        </h2>
        <Link
          to="/documents"
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          data-testid="home-documents-upload-link"
        >
          <FileText className="h-4 w-4" />
          Add a document
        </Link>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12" data-testid="home-documents-loading">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error instanceof Error ? error.message : 'Failed to load documents'}
        </div>
      )}

      {documents && total === 0 && (
        <p className="py-12 text-center text-sm text-gray-500" data-testid="home-documents-empty">
          No home documents yet. Upload a manual, warranty, insurance policy, or
          property-tax statement in{' '}
          <Link to="/documents" className="text-blue-600 hover:underline">
            Documents
          </Link>{' '}
          and it’ll show up here once it’s read.
        </p>
      )}

      {groups.map((group) => (
        <section key={group.id} data-testid={`home-documents-group-${group.id}`}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            {group.label}
          </h3>
          <div className="space-y-2">
            {group.documents.map((doc) => (
              <DocumentListItem key={doc.id} document={doc} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
