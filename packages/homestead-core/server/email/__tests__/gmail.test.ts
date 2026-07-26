/**
 * Tests for the Gmail provider. `fetch` is stubbed — no network — so we assert
 * the request URLs/bodies and the parsing of representative Gmail payloads
 * (nested multipart, an inline image that must be excluded, base64url bodies).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GmailProvider } from '../gmail';
import type { GmailAuthConfig } from '../../../apps/config';

const auth: GmailAuthConfig = {
  clientId: 'client',
  clientSecret: 'secret',
  refreshToken: 'refresh',
};

const b64url = (s: string): string => Buffer.from(s, 'utf-8').toString('base64url');

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Records every fetch call so tests can assert on URLs/bodies. */
interface Call {
  url: string;
  init?: RequestInit;
}
let calls: Call[];

/** Route a fetch by URL substring; returns a Response or throws if unmatched. */
function routeFetch(routes: Array<[RegExp, (call: Call) => Response]>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = typeof url === 'string' ? url : url.toString();
      calls.push({ url: u, init });
      for (const [re, handler] of routes) {
        if (re.test(u)) return handler({ url: u, init });
      }
      throw new Error(`unexpected fetch: ${u}`);
    }),
  );
}

const tokenRoute: [RegExp, (c: Call) => Response] = [
  /oauth2\.googleapis\.com\/token/,
  () => json({ access_token: 'access-tok', expires_in: 3600 }),
];

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GmailProvider token handling', () => {
  it('mints an access token once and reuses it across calls', async () => {
    routeFetch([
      tokenRoute,
      [/\/messages\?/, () => json({ messages: [{ id: 'm1', threadId: 't1' }] })],
      [/\/messages\/m1\?/, () => json({ id: 'm1', payload: {} })],
    ]);
    const gmail = new GmailProvider(auth);
    await gmail.listMessages({ query: 'has:attachment' });
    await gmail.getMessage('m1');

    const tokenCalls = calls.filter((c) => /oauth2/.test(c.url));
    expect(tokenCalls).toHaveLength(1);
    // The refresh-token grant is form-encoded.
    expect(String(tokenCalls[0].init?.body)).toContain('grant_type=refresh_token');
    // API calls carry the minted bearer token.
    const apiCall = calls.find((c) => /\/messages\?/.test(c.url))!;
    expect(new Headers(apiCall.init?.headers).get('Authorization')).toBe('Bearer access-tok');
  });

  it('surfaces a refresh-token failure as a clear error', async () => {
    routeFetch([
      [/oauth2/, () => json({ error: 'invalid_grant' }, 400)],
    ]);
    const gmail = new GmailProvider(auth);
    await expect(gmail.listMessages()).rejects.toThrow(/token exchange failed/i);
  });
});

describe('GmailProvider.listMessages', () => {
  it('passes the query and returns lightweight refs', async () => {
    routeFetch([
      tokenRoute,
      [
        /\/messages\?/,
        () => json({ messages: [{ id: 'a', threadId: 'ta' }, { id: 'b' }] }),
      ],
    ]);
    const gmail = new GmailProvider(auth);
    const refs = await gmail.listMessages({ query: 'has:attachment', maxResults: 10 });

    expect(refs).toEqual([{ id: 'a', threadId: 'ta' }, { id: 'b' }]);
    const listCall = calls.find((c) => /\/messages\?/.test(c.url))!;
    expect(listCall.url).toContain('q=has%3Aattachment');
    expect(listCall.url).toContain('maxResults=10');
  });

  it('returns an empty list when Gmail reports no messages', async () => {
    routeFetch([tokenRoute, [/\/messages\?/, () => json({})]]);
    const gmail = new GmailProvider(auth);
    expect(await gmail.listMessages()).toEqual([]);
  });
});

describe('GmailProvider.getMessage', () => {
  const payload = {
    id: 'm1',
    threadId: 't1',
    snippet: 'Here is your receipt',
    internalDate: '1700000000000',
    payload: {
      mimeType: 'multipart/mixed',
      headers: [
        { name: 'From', value: 'Alice <alice@example.com>' },
        { name: 'To', value: 'Bob <bob@example.com>, carol@example.com' },
        { name: 'Subject', value: 'Your receipt' },
      ],
      parts: [
        {
          mimeType: 'multipart/alternative',
          parts: [
            { mimeType: 'text/plain', body: { data: b64url('Plain body') } },
            { mimeType: 'text/html', body: { data: b64url('<p>HTML body</p>') } },
          ],
        },
        {
          mimeType: 'application/pdf',
          filename: 'receipt.pdf',
          body: { attachmentId: 'att-1', size: 1234 },
        },
        // Inline signature image — MUST be excluded from attachments.
        {
          mimeType: 'image/png',
          filename: 'logo.png',
          headers: [{ name: 'Content-Disposition', value: 'inline; filename="logo.png"' }],
          body: { attachmentId: 'att-2', size: 50 },
        },
      ],
    },
  };

  it('parses headers, bodies, and only real attachments', async () => {
    routeFetch([tokenRoute, [/\/messages\/m1\?/, () => json(payload)]]);
    const gmail = new GmailProvider(auth);
    const msg = await gmail.getMessage('m1');

    expect(msg.id).toBe('m1');
    expect(msg.threadId).toBe('t1');
    expect(msg.from).toEqual({ name: 'Alice', email: 'alice@example.com' });
    expect(msg.to).toEqual([
      { name: 'Bob', email: 'bob@example.com' },
      { email: 'carol@example.com' },
    ]);
    expect(msg.subject).toBe('Your receipt');
    expect(msg.date).toBe(new Date(1700000000000).toISOString());
    expect(msg.body).toEqual({ text: 'Plain body', html: '<p>HTML body</p>' });

    // Only the PDF; the inline PNG is dropped.
    expect(msg.attachments).toEqual([
      { id: 'att-1', filename: 'receipt.pdf', mimeType: 'application/pdf', size: 1234 },
    ]);
    // format=full requested.
    expect(calls.find((c) => /\/messages\/m1/.test(c.url))!.url).toContain('format=full');
  });

  it('handles a small inline attachment carried as body.data (no attachmentId)', async () => {
    const inlinePayload = {
      id: 'm2',
      payload: {
        mimeType: 'multipart/mixed',
        parts: [
          {
            mimeType: 'application/pdf',
            filename: 'small.pdf',
            body: { size: 4, data: b64url('DATA') },
          },
        ],
      },
    };
    routeFetch([tokenRoute, [/\/messages\/m2\?/, () => json(inlinePayload)]]);
    const gmail = new GmailProvider(auth);
    const msg = await gmail.getMessage('m2');

    expect(msg.attachments).toHaveLength(1);
    // The bytes are fetched with no extra network call.
    const bytes = await gmail.getAttachment('m2', msg.attachments[0].id);
    expect(bytes.toString('utf-8')).toBe('DATA');
    expect(calls.some((c) => /attachments/.test(c.url))).toBe(false);
  });
});

describe('GmailProvider.getAttachment', () => {
  it('base64url-decodes the attachment bytes', async () => {
    routeFetch([
      tokenRoute,
      [/\/messages\/m1\/attachments\/att-1/, () => json({ data: b64url('PDF-CONTENT'), size: 11 })],
    ]);
    const gmail = new GmailProvider(auth);
    const bytes = await gmail.getAttachment('m1', 'att-1');
    expect(Buffer.isBuffer(bytes)).toBe(true);
    expect(bytes.toString('utf-8')).toBe('PDF-CONTENT');
  });
});

describe('GmailProvider.sendMessage', () => {
  it('posts a base64url MIME blob with the right headers', async () => {
    routeFetch([
      tokenRoute,
      [/\/messages\/send/, () => json({ id: 'sent-1', threadId: 'th-1' })],
    ]);
    const gmail = new GmailProvider(auth);
    const result = await gmail.sendMessage({
      to: ['bob@example.com'],
      cc: ['carol@example.com'],
      subject: 'Hi',
      text: 'Hello there',
    });

    expect(result).toEqual({ id: 'sent-1', threadId: 'th-1' });
    const sendCall = calls.find((c) => /\/messages\/send/.test(c.url))!;
    const body = JSON.parse(String(sendCall.init?.body)) as { raw: string };
    const mime = Buffer.from(body.raw, 'base64url').toString('utf-8');
    expect(mime).toContain('To: bob@example.com');
    expect(mime).toContain('Cc: carol@example.com');
    expect(mime).toContain('Subject: Hi');
    expect(mime).toContain('Hello there');
  });
});

describe('GmailProvider.trashMessage', () => {
  it('POSTs to the trash endpoint', async () => {
    routeFetch([tokenRoute, [/\/messages\/m1\/trash/, () => json({ id: 'm1' })]]);
    const gmail = new GmailProvider(auth);
    await gmail.trashMessage('m1');
    const trashCall = calls.find((c) => /trash/.test(c.url))!;
    expect(trashCall.init?.method).toBe('POST');
  });

  it('throws on a non-2xx trash response', async () => {
    routeFetch([tokenRoute, [/\/messages\/m1\/trash/, () => json({ error: 'nope' }, 403)]]);
    const gmail = new GmailProvider(auth);
    await expect(gmail.trashMessage('m1')).rejects.toThrow(/trash m1 → 403/);
  });
});
