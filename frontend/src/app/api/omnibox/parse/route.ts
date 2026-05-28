/**
 * POST /api/omnibox/parse
 *
 * Thin wrapper around the runtime-agnostic parser in
 * `@rambleraptor/homestead-core/server/omnibox`. The real logic moved
 * there so the Bun sidecar can serve this route too.
 */

import { NextRequest } from 'next/server';
import { parseOmniboxRequest } from '@rambleraptor/homestead-core/server/omnibox';

export async function POST(request: NextRequest) {
  return parseOmniboxRequest(request);
}
