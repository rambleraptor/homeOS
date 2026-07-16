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
      // An empty object fails the handler's "did we read anything?" check.
      const payload = body.includes(FAIL_IMAGE) ? {} : STUB_RECEIPT;
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
