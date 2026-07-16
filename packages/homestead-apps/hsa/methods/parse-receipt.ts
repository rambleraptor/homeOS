/**
 * `hsa-receipts:parse-receipt` async custom method (AEP-136 + AEP-151).
 *
 * Lives on the hsa-receipt collection; dispatched by the gateway as
 * `POST /api/aep/hsa-receipts:parse-receipt`. Body: `{ image: base64, mimeType }`.
 *
 * Long-running: reading a receipt is a slow AI call, so the call returns `202`
 * with an Operation and the parse runs in the background. The resolved value
 * (`{ data: ParsedReceiptData, message }`) becomes the operation's `response`;
 * a throw becomes its `error`. Clients poll the operation (see
 * `awaitOperation` in core/api/operations).
 *
 * Preconditions (AI configured, well-formed body) are checked in `validate`,
 * which runs *before* an operation exists so bad calls still get a plain
 * 503/400 rather than a 202 + failed operation.
 */

import { z } from 'zod';
import type {
  AsyncCustomMethodHandler,
  AsyncCustomMethodValidator,
} from '@rambleraptor/homestead-core/resources/types';
import { isAiConfigured } from '@rambleraptor/homestead-core/server/ai/config';
import {
  aiGenerateObject,
  type ModelMessage,
} from '@rambleraptor/homestead-core/server/ai/generate';

interface ParsedReceiptData {
  merchant: string;
  service_date: string;
  amount: number;
  category: 'Medical' | 'Dental' | 'Vision' | 'Rx';
  patient?: string;
}

/** Schema the model fills. All optional so a partial read degrades gracefully
 *  rather than failing validation; defaults are applied below. */
const receiptSchema = z.object({
  merchant: z.string().optional(),
  service_date: z.string().optional(),
  amount: z.number().optional(),
  category: z.enum(['Medical', 'Dental', 'Vision', 'Rx']).optional(),
  patient: z.string().optional(),
});

async function parseReceiptFromImage(
  imageBase64: string,
  mimeType: string,
): Promise<ParsedReceiptData> {
  const prompt = `You are a medical receipt parser. Analyze this receipt image and extract the following information:

1. Merchant/Provider name (e.g., "CVS Pharmacy", "Dr. Smith's Office", "ABC Dental")
2. Service date (in YYYY-MM-DD format)
3. Total amount paid (as a number, do not include currency symbols)
4. Category (one of: Medical, Dental, Vision, Rx)
5. Patient name (if visible, otherwise leave empty)

Rules:
- Return ONLY a valid JSON object with these exact keys: merchant, service_date, amount, category, patient
- For service_date, use YYYY-MM-DD format (e.g., "2024-01-15")
- For amount, return only the number without $ or currency symbols (e.g., 125.50)
- For category, return EXACTLY one of: Medical, Dental, Vision, Rx
- If the image is not a medical receipt, return an empty JSON object: {}
- If a field cannot be determined, use these defaults:
  - merchant: "Unknown Provider"
  - service_date: today's date
  - amount: 0
  - category: "Medical"
  - patient: "" (empty string)`;

  const messages: ModelMessage[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'file', data: imageBase64, mediaType: mimeType },
      ],
    },
  ];
  const parsed = await aiGenerateObject({ messages, schema: receiptSchema });

  if (!parsed.merchant && !parsed.service_date && parsed.amount === undefined) {
    throw new Error('No receipt data found in image');
  }

  return {
    merchant: parsed.merchant || 'Unknown Provider',
    service_date: parsed.service_date || new Date().toISOString().split('T')[0],
    amount: typeof parsed.amount === 'number' ? parsed.amount : 0,
    category: parsed.category ?? 'Medical',
    patient: parsed.patient || '',
  };
}

interface ParseReceiptBody {
  image?: unknown;
  mimeType?: unknown;
}

/**
 * Reject calls that can't start: AI unconfigured, or a missing/invalid body.
 * Runs before the operation is created, so these stay ordinary HTTP errors.
 */
export const validate: AsyncCustomMethodValidator = async ({ request }) => {
  if (!isAiConfigured()) {
    return Response.json(
      { error: 'Service unavailable', message: 'AI is not configured on the server' },
      { status: 503 },
    );
  }

  const data = (await request.json().catch(() => null)) as ParseReceiptBody | null;
  if (!data || !data.image || !data.mimeType) {
    return Response.json(
      { error: 'Bad request', message: 'Missing required fields: image, mimeType' },
      { status: 400 },
    );
  }

  if (typeof data.mimeType !== 'string' || !data.mimeType.startsWith('image/')) {
    return Response.json(
      { error: 'Bad request', message: 'Invalid file type. Must be an image.' },
      { status: 400 },
    );
  }
};

/**
 * The long-running half: `validate` has already vetted the body, so a throw
 * here is a genuine parse failure and lands on the operation's `error`.
 */
const handler: AsyncCustomMethodHandler = async ({ request, auth }) => {
  const { image, mimeType } = (await request.json()) as {
    image: string;
    mimeType: string;
  };

  console.log(`Parsing receipt image for user ${auth.user.id}`);

  const receiptData = await parseReceiptFromImage(image, mimeType);
  return { data: receiptData, message: 'Receipt parsed successfully' };
};

export default handler;
