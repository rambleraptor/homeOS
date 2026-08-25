/**
 * The HTML→text pass exists for one job: turning a receipt-style HTML email
 * into readable, ingestible plain text. These pin the properties that job
 * depends on — visible text survives, invisible subtrees don't, and line/cell
 * structure stays legible.
 */

import { describe, it, expect } from 'vitest';
import { htmlToText, emailBodyText } from '../body-text';
import type { EmailMessage } from '../types';

describe('htmlToText', () => {
  it('strips tags but keeps the visible text', () => {
    expect(htmlToText('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });

  it('drops style, script, head, and comments entirely', () => {
    const html =
      '<head><title>x</title></head><style>.a{color:red}</style>' +
      '<script>alert(1)</script><!-- hidden --><p>Visible</p>';
    expect(htmlToText(html)).toBe('Visible');
  });

  it('turns block boundaries and <br> into line breaks', () => {
    const html = '<div>Order #123</div><p>Thanks!</p>Line one<br>Line two';
    expect(htmlToText(html)).toBe('Order #123\nThanks!\nLine one\nLine two');
  });

  it('keeps table rows as lines with space-separated cells', () => {
    const html =
      '<table><tr><td>Widget</td><td>$12.34</td></tr>' +
      '<tr><td>Tax</td><td>$1.02</td></tr></table>';
    expect(htmlToText(html)).toBe('Widget $12.34\nTax $1.02');
  });

  it('decodes numeric and named entities, ampersand last', () => {
    expect(htmlToText('Tom &amp; Jerry &#8212; &quot;duo&quot; &#x24;5&nbsp;off')).toBe(
      'Tom & Jerry — "duo" $5 off',
    );
    // &amp;lt; is a literal "&lt;", not a "<".
    expect(htmlToText('a &amp;lt; b')).toBe('a &lt; b');
  });

  it('collapses runs of whitespace but keeps paragraph gaps to one blank line', () => {
    const html = '<p>First</p>\n\n\n   <p>Second</p><p></p><p></p><p>Third</p>';
    expect(htmlToText(html)).toBe('First\n\nSecond\n\nThird');
  });
});

describe('emailBodyText', () => {
  function message(body?: EmailMessage['body']): EmailMessage {
    return { id: 'm1', attachments: [], ...(body ? { body } : {}) };
  }

  it('prefers the sender-provided plain-text part', () => {
    const msg = message({ text: 'plain version', html: '<p>html version</p>' });
    expect(emailBodyText(msg)).toBe('plain version');
  });

  it('falls back to stripped HTML when there is no text part', () => {
    const msg = message({ html: '<p>Your total is <b>$42.00</b></p>' });
    expect(emailBodyText(msg)).toBe('Your total is $42.00');
  });

  it('ignores a whitespace-only text part in favour of the HTML', () => {
    const msg = message({ text: '   \n ', html: '<p>real content</p>' });
    expect(emailBodyText(msg)).toBe('real content');
  });

  it('returns empty for a message with no body at all', () => {
    expect(emailBodyText(message())).toBe('');
    expect(emailBodyText(message({}))).toBe('');
  });
});
