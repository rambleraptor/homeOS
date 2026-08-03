/**
 * Behind-the-scenes trigger that indexes `ai`-enabled file fields on upload.
 *
 * The engine's file-write path has no hook and can't call AI (it's a
 * feature-free aepbase port), so this lives in the `/api/aep` gateway — the one
 * layer that sits in front of the engine and sees every CRUD write. On a
 * multipart create/update that carries an opted-in file field it forwards the
 * request untouched, then fires one background {@link indexFile} operation per
 * uploaded field; on a delete it purges that record's vectors.
 *
 * The (record, field) pair is the unit of work: only fields actually present in
 * *this* request are re-indexed, so a metadata-only PATCH doesn't touch the file.
 */

import { authenticate, aepUpdate } from '@rambleraptor/homestead-core/server/aepbase';
import { sha256Hex } from '@rambleraptor/homestead-core/server/hash';
import { operationStore } from '@rambleraptor/homestead-core/server/operations';
import { makeOperationLogger } from '@rambleraptor/homestead-core/resources/operations';
import { runOperationJob } from '@rambleraptor/homestead-core/resources/operation-runner';
import { indexFile } from '@rambleraptor/homestead-core/server/vectors/index-file';
import { getVectorStore } from '@rambleraptor/homestead-core/server/vectors/store';
import {
  aiFileFields,
  resolveEmbedOptions,
} from '@rambleraptor/homestead-core/resources/ai-fields';
import type { FieldDef, ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';
import { getAllResourceDefs } from '../app-registry';
import { createLogger } from '../log';
import { parseCrudWrite, idFromCreateBody } from './file-index-paths';

const log = createLogger('file-index');

/** Passthrough shape provided by the gateway (forwards to the engine in-process). */
export type Passthrough = (request: Request, path: string) => Promise<Response>;

/**
 * Top-level resources that have at least one text-extracting file field, indexed
 * by plural. Built lazily on first use (resource defs are static once the app
 * registry is installed at boot). Nested (parented) resources are excluded for
 * now — auto-indexing them needs parent-path plumbing the loopback calls don't
 * yet carry; declare `ai` only on top-level resources until then.
 */
let cache: Map<string, ResourceDefinition> | null = null;
function aiFileResources(): Map<string, ResourceDefinition> {
  if (!cache) {
    cache = new Map();
    for (const def of getAllResourceDefs()) {
      if (def.parents?.length) continue;
      if (aiFileFields(def).length > 0) cache.set(def.plural, def);
    }
  }
  return cache;
}

/**
 * Intercept a CRUD write to an ai-file resource. Returns a `Response` when it
 * handled the request (forwarding it and scheduling indexing), or `null` to let
 * the gateway dispatch it normally (non-write, non-CRUD, non-ai resource, or a
 * JSON write that carries no file).
 */
export async function handleCrudWithIndexing(
  request: Request,
  path: string,
  passthrough: Passthrough,
): Promise<Response | null> {
  const method = request.method;
  if (method !== 'POST' && method !== 'PATCH' && method !== 'PUT' && method !== 'DELETE') {
    return null;
  }
  const write = parseCrudWrite(path);
  if (!write) return null;
  const def = aiFileResources().get(write.plural);
  if (!def) return null;

  if (method === 'DELETE') {
    const res = await passthrough(request, path);
    if (res.ok && write.id) {
      void getVectorStore()
        ?.purge({ resource: def.singular, record: write.id })
        .catch((err) => logFailure('purge', def.singular, write.id!, err));
    }
    return res;
  }

  // Only a multipart body can carry a file upload; a JSON write (e.g. editing
  // `title`) never touches the file, so let it pass through untouched.
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) return null;

  // Buffer once so we can both inspect which file fields were uploaded and
  // forward the identical bytes to the engine. (Household files are small; the
  // engine buffers them to write to disk anyway.)
  const bytes = new Uint8Array(await request.arrayBuffer());
  const form = await new Response(bytes, {
    headers: { 'content-type': contentType },
  }).formData();

  const uploaded = aiFileFields(def).filter(
    ([name]) => form.get(name) instanceof Blob,
  );

  const forward = new Request(request.url, {
    method,
    headers: request.headers,
    body: bytes,
  });
  const res = await passthrough(forward, path);
  if (!res.ok || uploaded.length === 0) return res;

  const recordId = write.id ?? idFromCreateBody(await res.clone().json().catch(() => null));
  if (!recordId) return res;

  // Re-authenticate (headers only — body is already consumed) to attribute the
  // operations and act as the uploader on the loopback calls.
  const auth = await authenticate(request);
  if (!auth) return res;

  for (const [fieldName, field] of uploaded) {
    void runIndexOperation({
      def,
      plural: write.plural,
      recordId,
      fieldName,
      field,
      token: auth.token,
      userId: auth.user.id,
    });
  }

  // Stamp a content hash for duplicate detection, when the resource opts in by
  // declaring a `content_hash` field and the write carried a single file. This
  // is what lets the documents email-ingest cron hard-block an email copy of a
  // hand-uploaded original — every stored file ends up with a hash regardless of
  // how it arrived. The cron sets `content_hash` itself on create, so this
  // no-ops there (the hash already matches). Best-effort: a failure must not
  // fail an upload whose bytes are already stored.
  if (def.fields.content_hash && uploaded.length === 1) {
    const blob = form.get(uploaded[0][0]);
    if (blob instanceof Blob) {
      const created = await res.clone().json().catch(() => null);
      const existing = typeof created?.content_hash === 'string' ? created.content_hash : undefined;
      void stampContentHash(def, write.plural, recordId, blob, existing, auth.token);
    }
  }
  return res;
}

/**
 * Compute the SHA-256 of an uploaded file and record it on the resource, unless
 * it already carries that hash (which is the case for a cron create that set it
 * inline). Runs as detached background work; on failure it only logs, since the
 * file itself is already stored.
 */
async function stampContentHash(
  def: ResourceDefinition,
  plural: string,
  recordId: string,
  blob: Blob,
  existing: string | undefined,
  token: string,
): Promise<void> {
  try {
    const hash = sha256Hex(new Uint8Array(await blob.arrayBuffer()));
    if (hash === existing) return;
    await aepUpdate(plural, recordId, { content_hash: hash }, token);
  } catch (err) {
    logFailure('content-hash', def.singular, recordId, err);
  }
}

/**
 * Create an operation, run the index pipeline under the shared concurrency gate,
 * and record the outcome on it. The record is created `pending` and queued
 * behind {@link operationRunner} so a burst of uploads can't stampede the
 * indexer; it flips to `running` (with a `started` log entry) once a slot frees.
 */
async function runIndexOperation(input: {
  def: ResourceDefinition;
  plural: string;
  recordId: string;
  fieldName: string;
  field: FieldDef;
  token: string;
  userId: string;
}): Promise<void> {
  const { def, plural, recordId, fieldName, field, token, userId } = input;
  let op;
  try {
    op = await operationStore.create({
      token,
      method: `${plural}/${recordId}:index-file`,
      title: `Index ${fieldName}`,
      createdBy: userId,
      status: 'pending',
    });
  } catch (err) {
    // Couldn't even create the operation — nothing tracks it, so log.
    logFailure('index', def.singular, recordId, err);
    return;
  }

  const opId = op.id;
  const logger = makeOperationLogger(operationStore, { token, id: opId });
  await runOperationJob({
    store: operationStore,
    token,
    operationId: opId,
    log: (message) => logger.log(message),
    work: () =>
      indexFile({
        resource: def.singular,
        plural,
        record: recordId,
        field: fieldName,
        embed: resolveEmbedOptions(field),
        token,
      }),
    timeoutLabel: `index ${def.singular}/${recordId}`,
  });
}

function logFailure(what: string, resource: string, record: string, err: unknown): void {
  log.error(`${what} failed`, { resource: `${resource}/${record}`, err });
}
