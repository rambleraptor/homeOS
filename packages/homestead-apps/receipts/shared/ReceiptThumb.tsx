/**
 * Receipt Thumbnail
 *
 * Small preview of whatever backs a receipt: the image itself when the file is
 * an image, a document icon for PDFs, a link to the source document when the
 * receipt was mirrored from one, or a neutral placeholder when there's nothing
 * attached at all. Resolves the file URL itself, so it adds no fetch a row
 * wasn't already making.
 */

import { FileText, Receipt as ReceiptIcon } from 'lucide-react';
import { useFileFieldUrl } from '@rambleraptor/homestead-core/api/resourceHooks';

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|heic|heif|avif)$/i;

interface ReceiptThumbProps {
  /** Collection the record lives in, e.g. `hsa-receipts`. */
  plural: string;
  id: string;
  /** Value of the record's `receipt_file` field, when it has one. */
  fileName?: string;
  /** `documents/{id}` this receipt was derived from, when it was. */
  sourceDocument?: string;
  /** Alt text for the image case, e.g. `Receipt from CVS Pharmacy`. */
  alt: string;
  size?: 'sm' | 'md';
}

export function ReceiptThumb({
  plural,
  id,
  fileName,
  sourceDocument,
  alt,
  size = 'md',
}: ReceiptThumbProps) {
  const url = useFileFieldUrl(plural, id, 'receipt_file', fileName);
  const dim = size === 'sm' ? 'w-10 h-10' : 'w-12 h-12';
  const box = `${dim} shrink-0 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden`;
  const isImage = fileName ? IMAGE_EXT.test(fileName) : false;

  // Image file → render the picture, linking out to the full-size view.
  if (fileName && isImage) {
    if (!url) {
      return <div className={`${box} animate-pulse`} aria-hidden="true" />;
    }
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={box}
        title="View receipt"
      >
        <img src={url} alt={alt} className="w-full h-full object-cover" />
      </a>
    );
  }

  const fileIcon = <FileText className="w-5 h-5 text-text-muted" aria-hidden="true" />;

  // Non-image attachment (e.g. a PDF) → document icon linking to the file.
  if (fileName && url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={box}
        title="View receipt"
      >
        {fileIcon}
      </a>
    );
  }

  // Mirrored from a classified document → link to that document.
  if (sourceDocument) {
    const docId = sourceDocument.split('/').pop();
    return (
      <a href={`/documents/${docId}`} className={box} title="View source document">
        {fileIcon}
      </a>
    );
  }

  return (
    <div className={box} aria-hidden="true">
      <ReceiptIcon className="w-5 h-5 text-gray-300" />
    </div>
  );
}
