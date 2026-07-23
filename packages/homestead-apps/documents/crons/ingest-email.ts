/**
 * `documents-ingest-email` cron handler.
 *
 * Every 5 minutes (see the `crons` entry in `../app.config.ts`), reads mail from
 * the configured {@link EmailProvider}, files each supported attachment as a
 * `documents` record, kicks off the same classify pipeline a hand-upload runs,
 * and then moves the source message to Trash so its (potentially private)
 * contents don't linger in the mailbox.
 *
 * Idempotency has two layers. Trashing a fully-processed message is the primary
 * guard — a trashed message drops out of the `has:attachment` search on the next
 * firing. The provenance fields (`source_email_id` + `source_email_attachment`)
 * are the backstop: if an upload partially fails or the process dies before the
 * trash call, the next run skips attachments already filed and only retries the
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
import { isAiConfigured } from '@rambleraptor/homestead-core/server/ai/config';
import {
  aepbaseFetch,
  aepCreateMultipart,
  aepList,
} from '@rambleraptor/homestead-core/server/aepbase';
import type { EmailAttachment } from '@rambleraptor/homestead-core/server/email/types';
import { DOCUMENTS } from '../resources';
import type { Document } from '../types';

/** Attachment types the documents classify pipeline can actually read. */
const SUPPORTED_MIME = /^(application\/pdf|image\/(jpeg|png|webp|gif))$/;

/** How many messages to hydrate per firing. Trashing keeps the backlog bounded. */
const MAX_MESSAGES = 50;

/** Strip the extension for a default title: "1099-int-2025.pdf" → "1099-int-2025". */
function titleFromFilename(name: string): string {
  return name.replace(/\.[^./]+$/, '') || name;
}

/** Stable per-message dedup key; the index disambiguates repeated filenames. */
function attachmentKey(index: number, att: EmailAttachment): string {
  return `${index}:${att.filename}`;
}

const handler: CronHandler = async ({ token, log }) => {
  if (!isEmailConfigured()) {
    await log('email not configured; skipping');
    return { skipped: true };
  }

  const provider = getEmailProvider();
  const query = getEmailConfig()?.query ?? 'has:attachment';
  const refs = await provider.listMessages({ query, maxResults: MAX_MESSAGES });
  await log(`found ${refs.length} message(s) matching "${query}"`);

  const aiReady = isAiConfigured();
  let uploaded = 0;
  let skipped = 0;
  let trashed = 0;

  for (const ref of refs) {
    const message = await provider.getMessage(ref.id);

    // Pair each supported attachment with its dedup key (index is over ALL
    // attachments so keys stay stable regardless of filtering).
    const supported = message.attachments
      .map((att, index) => ({ att, key: attachmentKey(index, att) }))
      .filter(({ att }) => SUPPORTED_MIME.test(att.mimeType));

    // Nothing we can file → leave the message untouched (never trash mail we
    // didn't consume).
    if (supported.length === 0) continue;

    // Which of this message's attachments are already filed?
    const existing = await aepList<Document>(
      DOCUMENTS,
      token,
      undefined,
      `source_email_id == '${ref.id}'`,
    );
    const filed = new Set(
      existing.map((d) => d.source_email_attachment).filter((v): v is string => !!v),
    );

    let messageFailed = false;
    for (const { att, key } of supported) {
      if (filed.has(key)) {
        skipped++;
        continue;
      }
      try {
        const bytes = await provider.getAttachment(message.id, att.id);
        const doc = await aepCreateMultipart<Document>(
          DOCUMENTS,
          {
            title: titleFromFilename(att.filename || 'email-attachment'),
            mime_type: att.mimeType,
            parse_status: 'pending',
            source_email_id: ref.id,
            source_email_attachment: key,
          },
          { filename: att.filename || 'attachment', contentType: att.mimeType, bytes },
          token,
        );
        uploaded++;
        filed.add(key);

        // Kick off classification (fire-and-forget; the upload is already
        // durable). Skip when AI is off — classify would just 503 and clutter
        // the Operations log.
        if (aiReady) {
          void aepbaseFetch(`/${DOCUMENTS}/${doc.id}:classify`, {
            token,
            method: 'POST',
            body: {},
          }).catch((error) => {
            console.error(`[documents] classify trigger failed for ${doc.id}`, error);
          });
        }
      } catch (error) {
        messageFailed = true;
        console.error(
          `[documents] failed to ingest attachment "${att.filename}" from message ${ref.id}`,
          error,
        );
      }
    }

    // Retire the message only once every supported attachment is safely filed.
    // A partial failure leaves it in place; provenance dedup makes the retry
    // upload only what's missing.
    if (!messageFailed) {
      try {
        await provider.trashMessage(ref.id);
        trashed++;
      } catch (error) {
        console.error(`[documents] failed to trash message ${ref.id}`, error);
      }
    }
  }

  await log(`uploaded ${uploaded}, skipped ${skipped}, trashed ${trashed}`);
  return { messages: refs.length, uploaded, skipped, trashed };
};

export default handler;
