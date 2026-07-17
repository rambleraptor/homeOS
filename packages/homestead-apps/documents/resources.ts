import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';
import { toVariants, UNKNOWN_DOC_TYPE } from './doc-types/docType';
import { getDocTypes } from './doc-types/registry';

export const DOCUMENTS = 'documents' as const;

/** Discriminator property for the `metadata` union. Also the derived column. */
export const DOC_TYPE_FIELD = 'doc_type' as const;

/** Parse lifecycle. `unmatched` is an expected outcome, not a failure. */
export const PARSE_STATUSES = ['pending', 'parsed', 'unmatched', 'failed'] as const;
export type ParseStatus = (typeof PARSE_STATUSES)[number];

/**
 * A thunk, not an array: `metadata`'s variants come from the doc-type YAML,
 * which is loaded into the registry at boot. `getAllResourceDefs()` calls this
 * after that install, whereas a module-level array would be built at import
 * time and race it. See `doc-types/registry.ts`.
 */
export const documentsResources = (): ResourceDefinition[] => [
  {
    singular: 'document',
    plural: DOCUMENTS,
    description:
      'An uploaded document — the file, its extracted text, and any metadata ' +
      'parsed from it when it matches a known document type.',
    user_settable_create: true,
    fields: {
      file: { type: 'file', required: true, description: 'pdf/jpeg/png' },
      title: { type: 'string', description: 'Defaults to the uploaded filename.' },
      /**
       * Recorded at upload because `:download` serves every file as
       * `application/octet-stream` — the classify handler can't recover the
       * real type from the bytes it reads back, and the model needs it.
       */
      mime_type: { type: 'string', description: 'The uploaded file’s MIME type.' },
      full_text: {
        type: 'string',
        description: 'Full text extracted from the document by the model.',
      },
      parse_status: {
        type: 'string',
        enum: PARSE_STATUSES,
        default: 'pending',
        description: 'Where the document is in the classify/extract lifecycle.',
      },
      confidence: {
        type: 'number',
        description: "The model's confidence in the matched type, 0-1.",
      },
      /**
       * The tagged union. Its `doc_type` tag and every variant field become
       * derived columns, so both are filterable:
       *   metadata.doc_type == 'form-1099-int' && metadata.box_1_interest > 500
       */
      metadata: {
        type: 'object',
        discriminator: DOC_TYPE_FIELD,
        variants: toVariants(getDocTypes()),
        description:
          'Fields parsed from the document, shaped by its matched type. ' +
          `Tagged "${UNKNOWN_DOC_TYPE}" when it matches none.`,
      },
      created_by: { type: 'string' },
    },
    // POST /api/aep/documents/{id}:classify — reads the stored file, so it
    // takes the record's id rather than re-uploading the bytes.
    customMethods: {
      classify: {
        target: 'item',
        async: true,
        title: 'Classify document',
        load: () => import('./methods/classify'),
      },
    },
  },
];
