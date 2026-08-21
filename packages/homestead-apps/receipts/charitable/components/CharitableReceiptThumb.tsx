/**
 * Thumbnail for a charitable receipt — the shared thumb, bound to the
 * `charitable-receipts` collection and named after the organization.
 */

import { ReceiptThumb } from '../../shared/ReceiptThumb';
import { CHARITABLE_RECEIPTS } from '../resources';
import type { CharitableReceipt } from '../types';

interface CharitableReceiptThumbProps {
  receipt: CharitableReceipt;
  size?: 'sm' | 'md';
}

export function CharitableReceiptThumb({
  receipt,
  size = 'md',
}: CharitableReceiptThumbProps) {
  return (
    <ReceiptThumb
      plural={CHARITABLE_RECEIPTS}
      id={receipt.id}
      fileName={receipt.receipt_file}
      sourceDocument={receipt.source_document}
      alt={`Acknowledgment from ${receipt.organization}`}
      size={size}
    />
  );
}
