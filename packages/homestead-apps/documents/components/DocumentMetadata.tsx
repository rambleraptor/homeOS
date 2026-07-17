/**
 * Render a document's parsed metadata.
 *
 * Driven entirely by the doc type's YAML declaration — field order, labels, and
 * which fields exist all come from there. That's what lets an operator add a
 * document type without touching any code: no component knows what a 1099-INT is.
 */

import { getDocType } from '../doc-types/registry';
import { UNKNOWN_DOC_TYPE } from '../doc-types/docType';
import type { DocumentMetadata as Metadata } from '../types';

interface DocumentMetadataProps {
  metadata?: Metadata;
}

export function DocumentMetadata({ metadata }: DocumentMetadataProps) {
  if (!metadata || metadata.doc_type === UNKNOWN_DOC_TYPE) return null;

  const docType = getDocType(metadata.doc_type);
  if (!docType) {
    // The document was parsed against a doc type that has since been removed or
    // renamed. The values are still in the record, so show them rather than
    // hiding data — just without labels we no longer have.
    return (
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="document-metadata">
        {Object.entries(metadata)
          .filter(([key]) => key !== 'doc_type')
          .map(([key, value]) => (
            <div key={key}>
              <dt className="text-xs text-gray-500">{key}</dt>
              <dd className="text-sm text-gray-900">{String(value)}</dd>
            </div>
          ))}
      </dl>
    );
  }

  // Declaration order, not object order: the YAML lists boxes in form order.
  const rows = Object.entries(docType.fields)
    .map(([name, field]) => ({ name, label: field.label, value: metadata[name] }))
    .filter((row) => row.value !== undefined && row.value !== '');

  if (!rows.length) {
    return (
      <p className="text-sm text-gray-500" data-testid="document-metadata-empty">
        No fields could be read from this {docType.label}.
      </p>
    );
  }

  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="document-metadata">
      {rows.map((row) => (
        <div key={row.name} data-testid={`document-field-${row.name}`}>
          <dt className="text-xs text-gray-500">{row.label}</dt>
          <dd className="text-sm font-medium text-gray-900">{String(row.value)}</dd>
        </div>
      ))}
    </dl>
  );
}
