/**
 * Resolve a charitable receipt's `receipt_file` to a blob URL the browser can
 * render. Thin wrapper over the shared `useFileFieldUrl`.
 */

import { useFileFieldUrl } from '@rambleraptor/homestead-core/api/resourceHooks';
import { CHARITABLE_RECEIPTS } from '../resources';
import type { CharitableReceipt } from '../types';

export function useCharitableReceiptUrl(
  receipt: CharitableReceipt | null | undefined,
): string | null {
  return useFileFieldUrl(
    CHARITABLE_RECEIPTS,
    receipt?.id,
    'receipt_file',
    receipt?.receipt_file,
  );
}
