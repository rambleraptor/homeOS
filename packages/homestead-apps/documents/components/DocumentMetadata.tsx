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

/**
 * Render a metadata value for display. Most fields are scalars; a doc type with
 * composite fields (a recipe's ingredient list, say) yields arrays/objects, so
 * flatten those to a readable line rather than `String()`-ing them to
 * `[object Object]`.
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    return value.map(formatValue).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .map(formatValue)
      .filter(Boolean)
      .join(' ');
  }
  return String(value);
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
              <dt className="text-xs text-text-muted">{key}</dt>
              <dd className="text-sm text-brand-navy">{formatValue(value)}</dd>
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
      <p className="text-sm text-text-muted" data-testid="document-metadata-empty">
        No fields could be read from this {docType.label}.
      </p>
    );
  }

  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="document-metadata">
      {rows.map((row) => (
        <div key={row.name} data-testid={`document-field-${row.name}`}>
          <dt className="text-xs text-text-muted">{row.label}</dt>
          <dd className="text-sm font-medium text-brand-navy">{formatValue(row.value)}</dd>
        </div>
      ))}
    </dl>
  );
}
