/**
 * documents-ingest-email cron handler. The email provider and the aepbase
 * helpers are mocked, so these assert the ingestion logic: which attachments
 * are uploaded, how dedup and duplicate filenames are handled, when a message
 * is trashed, and the classify trigger.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  EmailMessage,
  EmailMessageRef,
} from '@rambleraptor/homestead-core/server/email/types';
import type { Document } from '../../types';

// --- mocks ---
const provider = {
  listMessages: vi.fn(),
  getMessage: vi.fn(),
  getAttachment: vi.fn(),
  sendMessage: vi.fn(),
  trashMessage: vi.fn(),
};
const isEmailConfigured = vi.fn();
const getEmailConfig = vi.fn();
const isAiConfigured = vi.fn();

vi.mock('@rambleraptor/homestead-core/server/email/config', () => ({
  isEmailConfigured: () => isEmailConfigured(),
  getEmailConfig: () => getEmailConfig(),
  getEmailProvider: () => provider,
}));
vi.mock('@rambleraptor/homestead-core/server/ai/config', () => ({
  isAiConfigured: () => isAiConfigured(),
}));

const aepList = vi.fn();
const aepCreateMultipart = vi.fn();
const aepbaseFetch = vi.fn();
vi.mock('@rambleraptor/homestead-core/server/aepbase', () => ({
  aepList: (...a: unknown[]) => aepList(...a),
  aepCreateMultipart: (...a: unknown[]) => aepCreateMultipart(...a),
  aepbaseFetch: (...a: unknown[]) => aepbaseFetch(...a),
}));

import handler from '../ingest-email';

const ctx = {
  id: 'documents-ingest-email',
  appId: 'documents',
  token: 'admin-tok',
  firedAt: '2026-07-23T00:00:00.000Z',
  log: vi.fn(async () => {}),
};

function pdfAttachment(over: Partial<EmailMessage['attachments'][number]> = {}) {
  return { id: 'att-1', filename: 'receipt.pdf', mimeType: 'application/pdf', size: 10, ...over };
}

function message(over: Partial<EmailMessage> = {}): EmailMessage {
  return { id: 'm1', attachments: [pdfAttachment()], ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
  isEmailConfigured.mockReturnValue(true);
  getEmailConfig.mockReturnValue({ query: 'has:attachment' });
  isAiConfigured.mockReturnValue(true);
  aepList.mockResolvedValue([]);
  aepCreateMultipart.mockResolvedValue({ id: 'doc-1' } as Document);
  aepbaseFetch.mockResolvedValue(new Response('{}'));
  // Distinct bytes per attachment by default, so content-hash dedup only fires
  // in the tests that deliberately supply identical bytes.
  provider.getAttachment.mockImplementation(async (_msgId: string, attId: string) =>
    Buffer.from(`bytes-${attId}`),
  );
  provider.trashMessage.mockResolvedValue(undefined);
});

describe('documents-ingest-email', () => {
  it('no-ops when email is unconfigured', async () => {
    isEmailConfigured.mockReturnValue(false);
    const result = await handler(ctx);
    expect(result).toEqual({ skipped: true });
    expect(provider.listMessages).not.toHaveBeenCalled();
  });

  it('uploads a supported attachment, fires classify, and trashes the message', async () => {
    provider.listMessages.mockResolvedValue([{ id: 'm1' }] as EmailMessageRef[]);
    provider.getMessage.mockResolvedValue(message());

    const result = await handler(ctx);

    expect(provider.getAttachment).toHaveBeenCalledWith('m1', 'att-1');
    expect(aepCreateMultipart).toHaveBeenCalledTimes(1);
    const [plural, fields, file, token] = aepCreateMultipart.mock.calls[0];
    expect(plural).toBe('documents');
    expect(fields).toMatchObject({
      title: 'receipt',
      mime_type: 'application/pdf',
      parse_status: 'pending',
      source_email_id: 'm1',
      source_email_attachment: '0:receipt.pdf',
      content_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(file).toMatchObject({ filename: 'receipt.pdf', contentType: 'application/pdf' });
    expect(token).toBe('admin-tok');

    // classify fired against the new doc
    expect(aepbaseFetch).toHaveBeenCalledWith(
      '/documents/doc-1:classify',
      expect.objectContaining({ method: 'POST', token: 'admin-tok' }),
    );
    expect(provider.trashMessage).toHaveBeenCalledWith('m1');
    expect(result).toEqual({ messages: 1, uploaded: 1, skipped: 0, duplicates: 0, trashed: 1 });
  });

  it('uses the configured query, defaulting to has:attachment', async () => {
    getEmailConfig.mockReturnValue({ query: 'label:homestead has:attachment' });
    provider.listMessages.mockResolvedValue([]);
    await handler(ctx);
    expect(provider.listMessages).toHaveBeenCalledWith({
      query: 'label:homestead has:attachment',
      maxResults: expect.any(Number),
    });
  });

  it('skips an already-filed attachment but still trashes the message', async () => {
    provider.listMessages.mockResolvedValue([{ id: 'm1' }]);
    provider.getMessage.mockResolvedValue(message());
    // Existing document for this message + attachment key.
    aepList.mockResolvedValue([
      { id: 'old', source_email_attachment: '0:receipt.pdf' } as Document,
    ]);

    const result = await handler(ctx);

    expect(aepCreateMultipart).not.toHaveBeenCalled();
    expect(provider.trashMessage).toHaveBeenCalledWith('m1');
    expect(result).toEqual({ messages: 1, uploaded: 0, skipped: 1, duplicates: 0, trashed: 1 });
  });

  it('hard-blocks an attachment whose content hash already exists, still trashing', async () => {
    provider.listMessages.mockResolvedValue([{ id: 'm1' }]);
    provider.getMessage.mockResolvedValue(message());
    // No same-message provenance match, but an existing doc has the same bytes.
    aepList.mockImplementation(async (_p: string, _t: string, _parent: unknown, filter?: string) =>
      filter?.startsWith('content_hash') ? [{ id: 'existing' } as Document] : [],
    );

    const result = await handler(ctx);

    // Blocked before any upload — the duplicate is not filed again.
    expect(aepCreateMultipart).not.toHaveBeenCalled();
    expect(provider.trashMessage).toHaveBeenCalledWith('m1');
    expect(result).toEqual({ messages: 1, uploaded: 0, skipped: 0, duplicates: 1, trashed: 1 });
  });

  it('hard-blocks a second identical attachment within the same run', async () => {
    provider.listMessages.mockResolvedValue([{ id: 'm1' }]);
    provider.getMessage.mockResolvedValue(
      message({
        attachments: [
          pdfAttachment({ id: 'a1', filename: 'first.pdf' }),
          pdfAttachment({ id: 'a2', filename: 'second.pdf' }),
        ],
      }),
    );
    // Both attachments return the same bytes → same hash. Nothing pre-exists.
    provider.getAttachment.mockResolvedValue(Buffer.from('identical-bytes'));

    const result = await handler(ctx);

    // First filed, second blocked as an in-run duplicate.
    expect(aepCreateMultipart).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ messages: 1, uploaded: 1, skipped: 0, duplicates: 1, trashed: 1 });
  });

  it('uploads both attachments that share a filename (distinct keys)', async () => {
    provider.listMessages.mockResolvedValue([{ id: 'm1' }]);
    provider.getMessage.mockResolvedValue(
      message({
        attachments: [
          pdfAttachment({ id: 'a1', filename: 'scan.pdf' }),
          pdfAttachment({ id: 'a2', filename: 'scan.pdf' }),
        ],
      }),
    );

    const result = await handler(ctx);

    expect(aepCreateMultipart).toHaveBeenCalledTimes(2);
    const keys = aepCreateMultipart.mock.calls.map((c) => c[1].source_email_attachment);
    expect(keys).toEqual(['0:scan.pdf', '1:scan.pdf']);
    expect(result.uploaded).toBe(2);
    expect(result.trashed).toBe(1);
  });

  it('ignores unsupported attachment types and leaves the message alone', async () => {
    provider.listMessages.mockResolvedValue([{ id: 'm1' }]);
    provider.getMessage.mockResolvedValue(
      message({
        attachments: [
          { id: 'z', filename: 'invite.ics', mimeType: 'text/calendar' },
          { id: 'z2', filename: 'archive.zip', mimeType: 'application/zip' },
        ],
      }),
    );

    const result = await handler(ctx);

    expect(aepCreateMultipart).not.toHaveBeenCalled();
    expect(provider.trashMessage).not.toHaveBeenCalled();
    expect(result).toEqual({ messages: 1, uploaded: 0, skipped: 0, duplicates: 0, trashed: 0 });
    // An all-zero run must say what it dropped, or it's undiagnosable.
    expect(ctx.log).toHaveBeenCalledWith(
      'message m1: skipping unsupported attachment(s): invite.ics (text/calendar), archive.zip (application/zip)',
    );
  });

  it('logs an unsupported attachment even when the message is trashed', async () => {
    provider.listMessages.mockResolvedValue([{ id: 'm1' }]);
    provider.getMessage.mockResolvedValue(
      message({
        attachments: [
          pdfAttachment(),
          { id: 'z', filename: 'notes.docx', mimeType: 'application/vnd.ms-word' },
        ],
      }),
    );

    const result = await handler(ctx);

    expect(result.uploaded).toBe(1);
    // Trashing takes the dropped attachment with it — that has to be on record.
    expect(provider.trashMessage).toHaveBeenCalledWith('m1');
    expect(ctx.log).toHaveBeenCalledWith(
      'message m1: skipping unsupported attachment(s): notes.docx (application/vnd.ms-word)',
    );
  });

  it('logs a message that parsed with no attachment parts at all', async () => {
    provider.listMessages.mockResolvedValue([{ id: 'm1' }]);
    provider.getMessage.mockResolvedValue(message({ attachments: [] }));

    const result = await handler(ctx);

    expect(result).toEqual({ messages: 1, uploaded: 0, skipped: 0, duplicates: 0, trashed: 0 });
    expect(ctx.log).toHaveBeenCalledWith(
      'message m1: no attachment parts found; leaving in place',
    );
  });

  it('does not trash a message when an upload fails', async () => {
    provider.listMessages.mockResolvedValue([{ id: 'm1' }]);
    provider.getMessage.mockResolvedValue(
      message({
        attachments: [
          pdfAttachment({ id: 'a1', filename: 'good.pdf' }),
          pdfAttachment({ id: 'a2', filename: 'bad.pdf' }),
        ],
      }),
    );
    aepCreateMultipart
      .mockResolvedValueOnce({ id: 'doc-good' })
      .mockRejectedValueOnce(new Error('boom'));

    const result = await handler(ctx);

    expect(result.uploaded).toBe(1);
    expect(provider.trashMessage).not.toHaveBeenCalled();
    expect(result.trashed).toBe(0);
  });

  it('does not fire classify when AI is unconfigured', async () => {
    isAiConfigured.mockReturnValue(false);
    provider.listMessages.mockResolvedValue([{ id: 'm1' }]);
    provider.getMessage.mockResolvedValue(message());

    await handler(ctx);

    expect(aepCreateMultipart).toHaveBeenCalledTimes(1);
    expect(aepbaseFetch).not.toHaveBeenCalled();
    expect(provider.trashMessage).toHaveBeenCalledWith('m1');
  });
});
