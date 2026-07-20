/**
 * Stub AI provider for e2e.
 *
 * The e2e server points `AI_BASE_URL` here (provider `openai`), so the real
 * `hsa-receipts:parse-receipt` method runs end-to-end without calling a paid
 * model. It speaks just enough of OpenAI's **Responses** API — the shape
 * `@ai-sdk/openai` uses by default — for the AI SDK's `generateObject` to
 * parse a result out of it.
 *
 * Two behaviours the specs rely on:
 *  - a deliberate {@link RESPONSE_DELAY_MS} pause, so the spawned operation
 *    stays `running` long enough for a test to observe the spinner UI. The
 *    delay lives here in the harness — never in product code.
 *  - a request carrying {@link FAIL_IMAGE} gets an empty object back, which
 *    makes the real handler throw ("No receipt data found in image") and the
 *    operation fail for real.
 */

import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';

/** Long enough to observe "running", short enough to keep tests quick. */
export const RESPONSE_DELAY_MS = 2500;

/** Base64 image payloads the specs send to steer the stub. */
export const OK_IMAGE = Buffer.from('ok-receipt').toString('base64');
export const FAIL_IMAGE = Buffer.from('fail-receipt').toString('base64');

/** The receipt the stub "reads" from OK_IMAGE. */
export const STUB_RECEIPT = {
  merchant: 'CVS Pharmacy',
  service_date: '2026-01-15',
  amount: 42.5,
  category: 'Rx',
  patient: 'Alex',
};

/**
 * Document classify markers.
 *
 * The `documents:classify` method reads the *stored* file and base64s it into
 * the request, so a document spec uploads a file whose bytes are one of these
 * markers and the stub keys on the base64 appearing in the body. Marker-first
 * routing means the stub needs no knowledge of the classify prompt's wording —
 * a request with no marker falls through to the receipt behaviour untouched.
 */
export const DOC_MARKERS = {
  match: 'e2e-document-form-1099-int',
  unknown: 'e2e-document-unrecognised',
  fail: 'e2e-document-parse-failure',
} as const;

/**
 * Fields the stub "reads" from a 1099-INT document — a realistic subset. The
 * schema makes every declared field `.nullable()` (present, but null when not
 * found), so the fields this stub doesn't read are explicit `null`s rather than
 * omitted; the handler's `stripNulls` drops them before storage.
 */
export const STUB_DOCUMENT_1099 = {
  full_text: 'Form 1099-INT  Interest Income  Ally Bank  Box 1 412.55',
  title: '2025 Ally Bank 1099-INT',
  confidence: 0.95,
  metadata: {
    doc_type: 'form-1099-int',
    payer_name: 'Ally Bank',
    payer_tin: 'XX-XXX6789',
    recipient_name: 'Alex Stephen',
    recipient_tin: null,
    box_1_interest: 412.55,
    box_2_early_withdrawal_penalty: null,
    box_3_savings_bond_interest: null,
    box_4_federal_tax_withheld: 0,
    box_8_tax_exempt_interest: null,
  },
};

/** A genuine "not a known type" read: low confidence, only the unknown tag. */
export const STUB_DOCUMENT_UNKNOWN = {
  full_text: 'Dear customer, thank you for your recent visit.',
  title: 'Customer letter',
  confidence: 0.15,
  metadata: { doc_type: 'unknown' },
};

/**
 * A schema-violating payload: `doc_type` names no known variant, so
 * `generateObject` fails validation and throws — driving the handler's failure
 * path (parse_status → failed) for real, the document analogue of FAIL_IMAGE.
 */
export const STUB_DOCUMENT_FAIL = {
  full_text: 'x',
  confidence: 0.5,
  metadata: { doc_type: 'not-a-real-document-type' },
};

/** Pick the model payload for a request body, marker-first. */
function payloadForBody(body: string): unknown {
  const has = (marker: string) => body.includes(Buffer.from(marker).toString('base64'));
  if (has(DOC_MARKERS.unknown)) return STUB_DOCUMENT_UNKNOWN;
  if (has(DOC_MARKERS.fail)) return STUB_DOCUMENT_FAIL;
  if (has(DOC_MARKERS.match)) return STUB_DOCUMENT_1099;
  // No document marker: the original receipt behaviour, unchanged.
  return body.includes(FAIL_IMAGE) ? {} : STUB_RECEIPT;
}

let server: Server | null = null;

/**
 * An OpenAI Responses-API reply carrying `payload` as the model's JSON output.
 * Mirrors `openaiResponsesResponseSchema` in @ai-sdk/openai.
 */
function responsesReply(payload: unknown) {
  return {
    id: 'resp-stub',
    created_at: 0,
    model: 'stub-model',
    status: 'completed',
    output: [
      {
        type: 'message',
        role: 'assistant',
        id: 'msg-stub',
        status: 'completed',
        // `annotations` is required by the provider's response schema.
        content: [
          { type: 'output_text', text: JSON.stringify(payload), annotations: [] },
        ],
      },
    ],
    usage: { input_tokens: 1, output_tokens: 1 },
  };
}

/** Start the stub on an ephemeral port; returns its OpenAI-style base URL. */
export async function startAiStub(): Promise<string> {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      const payload = payloadForBody(body);
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responsesReply(payload)));
      }, RESPONSE_DELAY_MS);
    });
  });

  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  const { port } = server!.address() as AddressInfo;
  return `http://127.0.0.1:${port}/v1`;
}

export async function stopAiStub(): Promise<void> {
  const active = server;
  server = null;
  if (!active) return;
  await new Promise<void>((resolve) => active.close(() => resolve()));
}
