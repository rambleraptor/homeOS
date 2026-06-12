/**
 * On-disk storage for resource file fields — port of pkg/filestore.
 * Layout mirrors the resource path: {root}/{resource_path}/{field_name},
 * e.g. data/files/gift-cards/abc123/front_image.
 */

import { createReadStream, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';

/** The DB column value marking that a file field has on-disk content. */
export const FILE_FIELD_SENTINEL = '1';

function sanitizeSegment(s: string): void {
  if (s === '' || s === '.' || s === '..' || s.includes('/') || s.includes('\\')) {
    throw new Error(`invalid path segment ${JSON.stringify(s)}`);
  }
}

/** Absolute on-disk path for a field; validates every component. */
export function filePath(root: string, resourcePath: string, field: string): string {
  if (!root) throw new Error('filestore root is empty');
  sanitizeSegment(field);
  const segments = resourcePath.split('/');
  for (const seg of segments) sanitizeSegment(seg);
  return join(root, ...segments, field);
}

export async function writeFileField(
  root: string,
  resourcePath: string,
  field: string,
  content: Blob,
): Promise<void> {
  const p = filePath(root, resourcePath, field);
  mkdirSync(dirname(p), { recursive: true });
  await writeFile(p, new Uint8Array(await content.arrayBuffer()));
}

/** A web ReadableStream over a disk file, for streaming Response bodies. */
export function openFileStream(path: string): ReadableStream {
  return Readable.toWeb(createReadStream(path)) as unknown as ReadableStream;
}

export function fileFieldExists(root: string, resourcePath: string, field: string): boolean {
  try {
    return existsSync(filePath(root, resourcePath, field));
  } catch {
    return false;
  }
}

export function fileFieldSize(root: string, resourcePath: string, field: string): number {
  return statSync(filePath(root, resourcePath, field)).size;
}

/** Remove every stored file for a resource (best-effort). */
export function deleteAllFileFields(root: string, resourcePath: string): void {
  if (!root) return;
  const segments = resourcePath.split('/');
  for (const seg of segments) sanitizeSegment(seg);
  const dir = join(root, ...segments);
  if (!existsSync(dir)) return;
  rmSync(dir, { recursive: true, force: true });
}
