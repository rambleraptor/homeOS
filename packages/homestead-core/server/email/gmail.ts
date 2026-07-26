/**
 * Gmail implementation of {@link EmailProvider}, over the Gmail REST API.
 *
 * Auth is a long-lived OAuth **refresh token** for a single mailbox
 * ({@link GmailAuthConfig}); each call uses a short-lived access token minted
 * from it and cached until just before it expires. Everything goes through the
 * global `fetch`, so this runs unchanged under Bun and Node.
 *
 * Reading maps 1:1 to the Gmail API: `messages.list` returns ids (our
 * {@link EmailMessageRef}s), `messages.get?format=full` returns the payload we
 * parse into an {@link EmailMessage}, and `messages.attachments.get` returns an
 * attachment's bytes. Writing uses `messages.send` (a base64url MIME blob) and
 * `messages.trash`.
 */

import type { GmailAuthConfig } from '../../apps/config';
import {
  EmailProvider,
  type EmailAddress,
  type EmailAttachment,
  type EmailMessage,
  type EmailMessageRef,
  type ListMessagesOptions,
  type SendMessageOptions,
  type SentMessage,
} from './types';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API_ROOT = 'https://gmail.googleapis.com/gmail/v1/users';

/** Refresh the access token this many ms before it actually expires. */
const TOKEN_SKEW_MS = 60_000;

/** Shape of a Gmail message payload part (`format=full`). */
interface GmailPart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: GmailPart[];
}

interface GmailMessage {
  id: string;
  threadId?: string;
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
}

/** Case-insensitive header lookup within a part. */
function header(part: GmailPart, name: string): string | undefined {
  const lower = name.toLowerCase();
  return part.headers?.find((h) => h.name.toLowerCase() === lower)?.value;
}

/**
 * Parse an address-list header (`To`, `From`) into {@link EmailAddress}es.
 * Deliberately simple — good enough for display/provenance, not a full RFC5322
 * parser. Splits on commas outside quotes and pulls `Name <addr>` apart.
 */
function parseAddresses(value: string | undefined): EmailAddress[] {
  if (!value) return [];
  const out: EmailAddress[] = [];
  for (const raw of value.split(',')) {
    const part = raw.trim();
    if (!part) continue;
    const m = /^(.*?)\s*<([^>]+)>$/.exec(part);
    if (m) {
      const name = m[1]!.replace(/^"|"$/g, '').trim();
      out.push({ email: m[2]!.trim(), ...(name ? { name } : {}) });
    } else {
      out.push({ email: part });
    }
  }
  return out;
}

/**
 * Below this many bytes, an `inline` part is treated as message chrome (a
 * signature logo, a tracking pixel, a bullet icon) rather than something the
 * sender meant to attach. Real scans and phone photos run hundreds of KB.
 */
const INLINE_CHROME_MAX_BYTES = 64 * 1024;

/** Byte length of a part's payload, whether it's fetched by id or carried inline. */
function partSize(part: GmailPart): number {
  if (part.body?.size !== undefined) return part.body.size;
  // base64url expands 3 bytes into 4 chars; close enough for a size threshold.
  return part.body?.data ? Math.floor((part.body.data.length * 3) / 4) : 0;
}

/**
 * True when a part is a real attachment rather than an inline body or message
 * chrome. A non-empty filename is required.
 *
 * `Content-Disposition: inline` alone can't be the test: Gmail's composer marks
 * a dragged-in photo inline inside a `multipart/related` and references it from
 * the HTML body via `cid:` — byte-for-byte the shape of a signature logo. A
 * `cid:` cross-check can't separate them either, so we fall back to size, which
 * does: chrome is a few KB, a photo or scan is hundreds.
 */
function isAttachmentPart(part: GmailPart): boolean {
  if (!part.filename) return false;
  const disposition = header(part, 'content-disposition')?.toLowerCase() ?? '';
  if (disposition.startsWith('inline') && partSize(part) < INLINE_CHROME_MAX_BYTES) {
    return false;
  }
  return true;
}

interface WalkResult {
  attachments: EmailAttachment[];
  text?: string;
  html?: string;
}

/** Recursively collect attachments and text/html bodies from a part tree. */
function walkParts(part: GmailPart | undefined, acc: WalkResult): void {
  if (!part) return;

  if (isAttachmentPart(part)) {
    acc.attachments.push({
      // Small attachments can arrive inline (no attachmentId) with the bytes in
      // body.data; encode the presence so getAttachment can fall back. We stash
      // the data under a sentinel id the provider recognizes.
      id: part.body?.attachmentId ?? `inline:${part.body?.data ?? ''}`,
      filename: part.filename!,
      mimeType: part.mimeType ?? 'application/octet-stream',
      ...(part.body?.size !== undefined ? { size: part.body.size } : {}),
    });
    return;
  }

  const mime = part.mimeType ?? '';
  if (mime === 'text/plain' && part.body?.data && acc.text === undefined) {
    acc.text = Buffer.from(part.body.data, 'base64url').toString('utf-8');
  } else if (mime === 'text/html' && part.body?.data && acc.html === undefined) {
    acc.html = Buffer.from(part.body.data, 'base64url').toString('utf-8');
  }

  for (const child of part.parts ?? []) walkParts(child, acc);
}

/** Convert a raw Gmail message into our provider-neutral shape. */
function toEmailMessage(msg: GmailMessage): EmailMessage {
  const payload = msg.payload ?? {};
  const acc: WalkResult = { attachments: [] };
  walkParts(payload, acc);

  const from = parseAddresses(header(payload, 'from'))[0];
  const to = parseAddresses(header(payload, 'to'));
  const subject = header(payload, 'subject');
  // internalDate is epoch millis as a string; fall back to the Date header.
  const date = msg.internalDate
    ? new Date(Number(msg.internalDate)).toISOString()
    : undefined;

  return {
    id: msg.id,
    ...(msg.threadId ? { threadId: msg.threadId } : {}),
    ...(from ? { from } : {}),
    ...(to.length ? { to } : {}),
    ...(subject ? { subject } : {}),
    ...(date ? { date } : {}),
    ...(msg.snippet ? { snippet: msg.snippet } : {}),
    ...(acc.text !== undefined || acc.html !== undefined
      ? { body: { ...(acc.text !== undefined ? { text: acc.text } : {}), ...(acc.html !== undefined ? { html: acc.html } : {}) } }
      : {}),
    attachments: acc.attachments,
  };
}

/** Encode a header value's addresses list back into a header string. */
function addressList(addrs: string[]): string {
  return addrs.join(', ');
}

/** Build a minimal RFC822 message for `messages.send`. */
function buildMime(options: SendMessageOptions): string {
  const lines: string[] = [];
  lines.push(`To: ${addressList(options.to)}`);
  if (options.cc?.length) lines.push(`Cc: ${addressList(options.cc)}`);
  if (options.bcc?.length) lines.push(`Bcc: ${addressList(options.bcc)}`);
  lines.push(`Subject: ${options.subject}`);
  lines.push('MIME-Version: 1.0');

  const { text, html } = options;
  if (text !== undefined && html !== undefined) {
    const boundary = 'homestead-boundary-alt';
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    lines.push('');
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/plain; charset="UTF-8"');
    lines.push('');
    lines.push(text);
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/html; charset="UTF-8"');
    lines.push('');
    lines.push(html);
    lines.push(`--${boundary}--`);
  } else if (html !== undefined) {
    lines.push('Content-Type: text/html; charset="UTF-8"');
    lines.push('');
    lines.push(html);
  } else {
    lines.push('Content-Type: text/plain; charset="UTF-8"');
    lines.push('');
    lines.push(text ?? '');
  }
  return lines.join('\r\n');
}

export class GmailProvider extends EmailProvider {
  private readonly auth: GmailAuthConfig;
  private readonly user: string;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(auth: GmailAuthConfig, user = 'me') {
    super();
    this.auth = auth;
    this.user = user;
  }

  /** Mint (or reuse a cached) access token from the refresh token. */
  private async token(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - TOKEN_SKEW_MS) {
      return this.accessToken;
    }
    const body = new URLSearchParams({
      client_id: this.auth.clientId,
      client_secret: this.auth.clientSecret,
      refresh_token: this.auth.refreshToken,
      grant_type: 'refresh_token',
    });
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).trim();
      throw new Error(
        `Gmail token exchange failed (${res.status})${detail ? `: ${detail}` : ''}` +
          ' — check the refresh token and client credentials',
      );
    }
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.accessToken = json.access_token;
    this.tokenExpiresAt = Date.now() + json.expires_in * 1000;
    return this.accessToken;
  }

  /** Authorized fetch against the Gmail API for this mailbox. */
  private async api(path: string, init?: RequestInit): Promise<Response> {
    const token = await this.token();
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(`${API_ROOT}/${encodeURIComponent(this.user)}${path}`, {
      ...init,
      headers,
    });
  }

  private async apiJson<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.api(path, init);
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).trim();
      throw new Error(`Gmail API ${path} → ${res.status}${detail ? `: ${detail}` : ''}`);
    }
    return (await res.json()) as T;
  }

  async listMessages(options: ListMessagesOptions = {}): Promise<EmailMessageRef[]> {
    const qs = new URLSearchParams();
    if (options.query) qs.set('q', options.query);
    if (options.maxResults !== undefined) {
      qs.set('maxResults', String(options.maxResults));
    }
    const body = await this.apiJson<{
      messages?: Array<{ id: string; threadId?: string }>;
    }>(`/messages?${qs}`);
    return (body.messages ?? []).map((m) => ({
      id: m.id,
      ...(m.threadId ? { threadId: m.threadId } : {}),
    }));
  }

  async getMessage(id: string): Promise<EmailMessage> {
    const msg = await this.apiJson<GmailMessage>(
      `/messages/${encodeURIComponent(id)}?format=full`,
    );
    return toEmailMessage(msg);
  }

  async getAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
    // Inline attachments carry their bytes directly (see walkParts): no fetch.
    if (attachmentId.startsWith('inline:')) {
      return Buffer.from(attachmentId.slice('inline:'.length), 'base64url');
    }
    const body = await this.apiJson<{ data: string }>(
      `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
    );
    return Buffer.from(body.data, 'base64url');
  }

  async sendMessage(options: SendMessageOptions): Promise<SentMessage> {
    const raw = Buffer.from(buildMime(options), 'utf-8').toString('base64url');
    const sent = await this.apiJson<{ id: string; threadId?: string }>(
      '/messages/send',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      },
    );
    return { id: sent.id, ...(sent.threadId ? { threadId: sent.threadId } : {}) };
  }

  async trashMessage(id: string): Promise<void> {
    const res = await this.api(`/messages/${encodeURIComponent(id)}/trash`, {
      method: 'POST',
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).trim();
      throw new Error(
        `Gmail trash ${id} → ${res.status}${detail ? `: ${detail}` : ''}`,
      );
    }
  }
}
