/**
 * Coarse classification of a document's underlying file by MIME type, used to
 * pick an icon/tint for the list tile and to decide how the detail viewer
 * renders it (image vs. embedded PDF vs. inline text vs. no inline preview).
 */

export type FileKind = 'pdf' | 'image' | 'text' | 'other';

export function fileKind(mime?: string): FileKind {
  if (mime === 'application/pdf') return 'pdf';
  if (mime?.startsWith('image/')) return 'image';
  // Only plain text renders inline: an iframe shows it inertly, whereas HTML
  // (e.g. an email body) would execute in a same-origin blob frame.
  if (mime === 'text/plain') return 'text';
  return 'other';
}
