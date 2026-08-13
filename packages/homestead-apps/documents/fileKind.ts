/**
 * Coarse classification of a document's underlying file by MIME type, used to
 * pick an icon/tint for the list tile and to decide how the detail viewer
 * renders it (image vs. embedded PDF vs. no inline preview).
 */

export type FileKind = 'pdf' | 'image' | 'other';

export function fileKind(mime?: string): FileKind {
  if (mime === 'application/pdf') return 'pdf';
  if (mime?.startsWith('image/')) return 'image';
  return 'other';
}
