/**
 * Plain-text rendering of an email body, for ingesting a message's *content*
 * as a document (the documents email cron files receipt-style emails that
 * carry no usable attachment).
 *
 * Deliberately not a full HTML renderer: marketing/receipt emails are deeply
 * nested table soup, and what downstream consumers need (the classify model,
 * the embedding pipeline, a human reading the stored file) is the visible text
 * with its reading order and line structure intact — not layout fidelity.
 * A tag-stripping pass with block-aware line breaks gets exactly that.
 *
 * Server-only, like everything under `core/server/email`.
 */

import type { EmailMessage } from './types';

/** Named entities that actually occur in mail HTML; `&amp;` must decode last. */
const NAMED_ENTITIES: Record<string, string> = {
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  copy: '©',
  reg: '®',
  trade: '™',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
};

/** Decode numeric (`&#65;` / `&#x41;`) and common named HTML entities. */
function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&([a-z]+);/gi, (match, name: string) => {
      const lower = name.toLowerCase();
      if (lower === 'amp') return match; // deferred to the final pass
      return NAMED_ENTITIES[lower] ?? match;
    })
    .replace(/&amp;/gi, '&');
}

/** Closing tags that end a visual block — each becomes a line break. */
const BLOCK_CLOSERS = /<\/(p|div|tr|li|h[1-6]|table|thead|tbody|ul|ol|blockquote|section|article|header|footer)\s*>/gi;

/**
 * Strip an HTML email body down to its visible text. Invisible subtrees
 * (`<style>`, `<script>`, `<head>`, comments) are dropped whole; block
 * boundaries and `<br>`s become newlines and table cells stay space-separated,
 * so a receipt's "Item … $12.34" rows survive as readable lines.
 */
export function htmlToText(html: string): string {
  let s = html;
  s = s.replace(/<(script|style|head|title)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(BLOCK_CLOSERS, '\n');
  // A cell/heading opener separates content from what came before it.
  s = s.replace(/<(td|th)\b[^>]*>/gi, ' ');
  s = s.replace(/<[^>]+>/g, '');
  s = decodeEntities(s);
  // Collapse the whitespace the markup left behind, preserving line structure.
  s = s.replace(/[ \t\u00a0]+/g, ' ');
  s = s.replace(/ ?\n ?/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

/**
 * The message body as plain text: the sender's `text/plain` part verbatim when
 * one exists (it's the sender's own plain rendering), otherwise the HTML part
 * stripped via {@link htmlToText}. Empty string when the message has neither —
 * callers treat that as "nothing to ingest".
 */
export function emailBodyText(message: EmailMessage): string {
  const text = message.body?.text?.trim();
  if (text) return text;
  const html = message.body?.html;
  if (html) return htmlToText(html);
  return '';
}
