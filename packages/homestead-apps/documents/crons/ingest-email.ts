/**
 * `documents-ingest-email` cron handler.
 *
 * Every 5 minutes (see the `crons` entry in `../app.config.ts`), reads mail from
 * the configured {@link EmailProvider} and files each message as documents,
 * kicks off the same classify pipeline a hand-upload runs, and then moves the
 * source message to Trash so its (potentially private) contents don't linger in
 * the mailbox.
 *
 * What gets filed, per message: every PDF attachment plus every *important*
 * image attachment (see {@link IMPORTANT_IMAGE_MIN_BYTES} — signature logos and
 * pixel-sized chrome don't count). When a message has none of those, the email
 * *body itself* is the document — receipts and confirmations routinely arrive
 * as pure HTML with no attachment at all. The body is stored as a `text/plain`
 * file (headers + text part, or the HTML stripped to its visible text) under
 * the reserved attachment key {@link BODY_KEY}.
 *
 * Idempotency has two layers. Trashing a fully-processed message is the primary
 * guard — a trashed message drops out of the configured search on the next
 * firing. The provenance fields (`source_email_id` + `source_email_attachment`)
 * are the backstop: if an upload partially fails or the process dies before the
 * trash call, the next run skips parts already filed and only retries the
 * missing ones.
 *
 * Server-only: lives under `crons/`, so vite stubs it out of the browser bundle.
 * The handler runs headless with a short-lived admin token from the scheduler.
 */

import type { CronHandler } from '@rambleraptor/homestead-core/apps/types';
import {
  isEmailConfigured,
  getEmailConfig,
  getEmailProvider,
} from '@rambleraptor/homestead-core/server/email/config';
import { emailBodyText } from '@rambleraptor/homestead-core/server/email/body-text';
import { isAiConfigured } from '@rambleraptor/homestead-core/server/ai/config';
import type { CollectionRef } from '@rambleraptor/homestead-client';
import { serverClient } from '@rambleraptor/homestead-core/server/client';
import { sha256Hex } from '@rambleraptor/homestead-core/server/hash';
import type {
  EmailAttachment,
  EmailMessage,
} from '@rambleraptor/homestead-core/server/email/types';
import { DOCUMENTS } from '../resources';
import type { Document } from '../types';

/** Image attachment types the documents classify pipeline can actually read. */
const IMAGE_MIME = /^image\/(jpeg|png|webp|gif)$/;

/**
 * An image attachment below this is treated as message chrome — a signature
 * logo or an icon attached outright rather than inline — not something worth
 * filing, and not a reason to skip the email body. Real scans and phone photos
 * run hundreds of KB. Mirrors the Gmail provider's inline-chrome threshold; an
 * image whose size the provider doesn't report gets the benefit of the doubt.
 */
const IMPORTANT_IMAGE_MIN_BYTES = 64 * 1024;

/** How many messages to hydrate per firing. Trashing keeps the backlog bounded. */
const MAX_MESSAGES = 50;

/**
 * Reserved `source_email_attachment` key for a document made from the message
 * body. Can't collide with attachment keys, which always contain a `:`.
 */
const BODY_KEY = 'body';

/** Strip the extension for a default title: "1099-int-2025.pdf" → "1099-int-2025". */
function titleFromFilename(name: string): string {
  return name.replace(/\.[^./]+$/, '') || name;
}

/** Stable per-message dedup key; the index disambiguates repeated filenames. */
function attachmentKey(index: number, att: EmailAttachment): string {
  return `${index}:${att.filename}`;
}

/** A PDF, or an image big enough to be a real photo/scan (see threshold above). */
function isIngestibleAttachment(att: EmailAttachment): boolean {
  if (att.mimeType === 'application/pdf') return true;
  if (!IMAGE_MIME.test(att.mimeType)) return false;
  return att.size === undefined || att.size >= IMPORTANT_IMAGE_MIN_BYTES;
}

/**
 * The stored plain-text rendering of a bodied message: a short provenance
 * header block (what a person — or the classify model — needs to know where
 * this came from) over the body text. Empty when the message has no readable
 * body at all.
 */
function renderBodyDocument(message: EmailMessage): string {
  const body = emailBodyText(message);
  if (!body) return '';
  const headers: string[] = [];
  if (message.from) {
    const { name, email } = message.from;
    headers.push(`From: ${name ? `${name} <${email}>` : email}`);
  }
  if (message.date) headers.push(`Date: ${message.date}`);
  if (message.subject) headers.push(`Subject: ${message.subject}`);
  return headers.length ? `${headers.join('\n')}\n\n${body}` : body;
}

/** Display title for a body document: the subject, else the sender, else generic. */
function bodyTitle(message: EmailMessage): string {
  const subject = message.subject?.trim();
  if (subject) return subject;
  const from = message.from;
  if (from) return `Email from ${from.name || from.email}`;
  return 'Email';
}

/** Filesystem-safe `.txt` filename derived from the body document's title. */
function bodyFilename(message: EmailMessage): string {
  const base = bodyTitle(message)
    .replace(/[/\\:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .trim();
  return `${base || 'email'}.txt`;
}

/**
 * Does a document with this exact content already exist? The hard-block guard
 * for the email flow: the same file reaching us twice — a statement forwarded, a
 * message re-sent, or an email copy of a hand-uploaded document — matches on
 * content hash even though its per-message attachment key differs. `content_hash`
 * is hex, so it's safe to inline into the filter expression.
 */
async function contentHashExists(
  documents: CollectionRef<Document>,
  hash: string,
): Promise<boolean> {
  const matches = await documents.listAll({ filter: `content_hash == '${hash}'` });
  return matches.length > 0;
}

const handler: CronHandler = async ({ token, log }) => {
  if (!isEmailConfigured()) {
    await log('email not configured; skipping');
    return { skipped: true };
  }

  const documents = serverClient(token).collection<Document>(DOCUMENTS);
  const provider = getEmailProvider();
  const query = getEmailConfig()?.query ?? 'has:attachment';
  const refs = await provider.listMessages({ query, maxResults: MAX_MESSAGES });
  await log(`found ${refs.length} message(s) matching "${query}"`);

  const aiReady = isAiConfigured();
  let uploaded = 0;
  let bodies = 0;
  let skipped = 0;
  let duplicates = 0;
  let trashed = 0;

  // Content hashes filed during this run, so two identical attachments in the
  // same firing (across different messages, before the first is queryable)
  // don't both get filed. Spans the whole run, not just one message.
  const seenHashes = new Set<string>();

  for (const ref of refs) {
    const message = await provider.getMessage(ref.id);

    // Pair each attachment with its dedup key (index is over ALL attachments so
    // keys stay stable regardless of filtering).
    const keyed = message.attachments.map((att, index) => ({
      att,
      key: attachmentKey(index, att),
    }));
    const ingestible = keyed.filter(({ att }) => isIngestibleAttachment(att));
    const dropped = keyed.filter(({ att }) => !isIngestibleAttachment(att));

    // Say out loud what we drop. Silence here is invisible in the Operations
    // log — the run just reports zeroes — and when the message has other
    // ingestible parts it gets trashed with the dropped one still inside.
    if (dropped.length > 0) {
      const seen = dropped
        .map(({ att }) => `${att.filename || '(unnamed)'} (${att.mimeType})`)
        .join(', ');
      await log(`message ${ref.id}: skipping unimportant attachment(s): ${seen}`);
    }

    // Which of this message's parts (attachments or body) are already filed?
    const existing = await documents.listAll({
      filter: `source_email_id == '${ref.id}'`,
    });
    const filed = new Set(
      existing.map((d) => d.source_email_attachment).filter((v): v is string => !!v),
    );

    // No ingestible attachment → the email body IS the document (receipts and
    // confirmations arrive as pure HTML all the time). A message with neither a
    // usable attachment nor a readable body is left untouched — never trash
    // mail we didn't consume.
    const bodyText = ingestible.length === 0 ? renderBodyDocument(message) : '';
    if (ingestible.length === 0 && !bodyText) {
      await log(
        `message ${ref.id}: no ingestible attachments and no readable body; leaving in place`,
      );
      continue;
    }

    // The unit of work per message: attachments when any qualify, else the
    // body. Each entry knows how to produce its bytes + document fields.
    const parts = ingestible.length
      ? ingestible.map(({ att, key }) => ({
          key,
          isBody: false,
          load: () => provider.getAttachment(message.id, att.id),
          fields: {
            title: titleFromFilename(att.filename || 'email-attachment'),
            mime_type: att.mimeType,
            filename: att.filename || 'attachment',
          },
        }))
      : [
          {
            key: BODY_KEY,
            isBody: true,
            load: async () => Buffer.from(bodyText, 'utf-8'),
            fields: {
              title: bodyTitle(message),
              mime_type: 'text/plain',
              filename: bodyFilename(message),
            },
          },
        ];

    let messageFailed = false;
    for (const part of parts) {
      if (filed.has(part.key)) {
        skipped++;
        continue;
      }
      try {
        const bytes = await part.load();
        const hash = sha256Hex(bytes);

        // Hard block: identical content already filed (in an earlier run or
        // earlier in this one) is a duplicate — don't file it again. The part
        // is still handled, so mark the key filed and let the message trash
        // normally; we just skip the redundant upload.
        const isDuplicate = seenHashes.has(hash) || (await contentHashExists(documents, hash));
        seenHashes.add(hash);
        if (isDuplicate) {
          duplicates++;
          filed.add(part.key);
          await log(
            `message ${ref.id}: ${part.key} duplicates an existing document ` +
              `(sha256 ${hash.slice(0, 12)}…); not filing`,
          );
          continue;
        }

        const doc = await documents.create({
          title: part.fields.title,
          mime_type: part.fields.mime_type,
          parse_status: 'pending',
          source_email_id: ref.id,
          source_email_attachment: part.key,
          content_hash: hash,
          // A File is a named Blob; the client auto-assembles it into the
          // multipart upload the engine's `file` field expects. Copy into a
          // fresh Uint8Array so the Buffer's backing store (typed as possibly
          // SharedArrayBuffer) satisfies BlobPart's stricter DOM types.
          file: new File([new Uint8Array(bytes)], part.fields.filename, {
            type: part.fields.mime_type,
          }),
        });
        uploaded++;
        if (part.isBody) bodies++;
        filed.add(part.key);

        // Kick off classification. Skip when AI is off — classify would just
        // 503 and clutter the Operations log.
        //
        // Await the trigger (which returns 202 as soon as the operation record
        // is created), not the classification itself — the work still runs in
        // the background pool. We wait only for acceptance so the operation
        // takes its lease on our short-lived admin token *before* this firing
        // returns and revokes it; otherwise the classify operation's own
        // lifecycle writes would race the revoke and strand it forever. A
        // trigger failure is logged but not fatal: the upload is already durable
        // and must not block trashing the message.
        if (aiReady) {
          try {
            await documents.record(doc.id).invoke('classify', {});
          } catch (error) {
            console.error(`[documents] classify trigger failed for ${doc.id}`, error);
          }
        }
      } catch (error) {
        messageFailed = true;
        console.error(
          `[documents] failed to ingest ${part.key} from message ${ref.id}`,
          error,
        );
      }
    }

    // Retire the message only once every part is safely filed. A partial
    // failure leaves it in place; provenance dedup makes the retry upload only
    // what's missing.
    if (!messageFailed) {
      try {
        await provider.trashMessage(ref.id);
        trashed++;
      } catch (error) {
        console.error(`[documents] failed to trash message ${ref.id}`, error);
      }
    }
  }

  await log(
    `uploaded ${uploaded} (${bodies} from email bodies), skipped ${skipped}, ` +
      `duplicates ${duplicates}, trashed ${trashed}`,
  );
  return { messages: refs.length, uploaded, bodies, skipped, duplicates, trashed };
};

export default handler;
