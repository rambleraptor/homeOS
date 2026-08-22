/**
 * Close a popover, menu, or dropdown when the pointer goes down outside it.
 *
 * The behaviour every menu in the app already implements by hand: while open,
 * a `mousedown` anywhere outside the anchor element dismisses it. Kept as a
 * hook so the listener is attached only while open and torn down on close,
 * which is the part that's easy to get wrong when it's copied.
 *
 * Escape is deliberately *not* handled here. A menu that owns a focused input
 * wants Escape on the input (so it doesn't also close a dialog behind it),
 * while a plain menu wants it on the document — one hook can't be right for
 * both, and a document-level listener is the surprising one.
 *
 * @param ref     the element that counts as "inside"
 * @param open    whether the surface is currently open
 * @param onClose called when a pointer goes down outside `ref`
 */

import { useEffect, type RefObject } from 'react';

export function useDismissOnOutside(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [ref, open, onClose]);
}
