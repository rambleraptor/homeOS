/**
 * HSA Receipt Thumbnail
 *
 * Shows a small preview of a receipt: the image itself when the file is an
 * image, a document icon for PDFs / source-document links, or a neutral
 * placeholder when nothing is attached. Reuses the same backend-aware URL hook
 * the row link uses, so it adds no extra fetch.
 */

import { FileText, Receipt as ReceiptIcon } from 'lucide-react';
import { useHSAReceiptUrl } from '../hooks/useHSAReceiptUrl';
import type { HSAReceipt } from '../types';

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|heic|heif|avif)$/i;

interface HSAReceiptThumbProps {
  receipt: HSAReceipt;
  size?: 'sm' | 'md';
}

export function HSAReceiptThumb({ receipt, size = 'md' }: HSAReceiptThumbProps) {
  const url = useHSAReceiptUrl(receipt);
  const dim = size === 'sm' ? 'w-10 h-10' : 'w-12 h-12';
  const box = `${dim} shrink-0 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden`;
  const isImage = receipt.receipt_file
    ? IMAGE_EXT.test(receipt.receipt_file)
    : false;

  // Image file → render the picture, linking out to the full-size view.
  if (receipt.receipt_file && isImage) {
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
        <img
          src={url}
          alt={`Receipt from ${receipt.merchant}`}
          className="w-full h-full object-cover"
        />
      </a>
    );
  }

  const fileIcon = (
    <FileText className="w-5 h-5 text-text-muted" aria-hidden="true" />
  );

  // Non-image attachment (e.g. a PDF) → document icon linking to the file.
  if (receipt.receipt_file && url) {
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
  if (receipt.source_document) {
    const docId = receipt.source_document.split('/').pop();
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
