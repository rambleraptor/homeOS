/**
 * Client transport for the chat backend (`POST /api/chat`, served by
 * the sidecar). Auth mirrors the other sidecar calls: forward the
 * aepbase bearer token plus the caller's user id.
 */

import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import type { ChatMessage, ChatRequest, ChatResponse } from './types';

/** Thrown when the server has no GEMINI_API_KEY configured (HTTP 503). */
export class ChatNotConfiguredError extends Error {
  constructor() {
    super('Chat is not configured on the server');
    this.name = 'ChatNotConfiguredError';
  }
}

export async function sendChat(messages: ChatMessage[]): Promise<ChatResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${aepbase.authStore.token}`,
      'X-User-Id': aepbase.getCurrentUser()?.id || '',
    },
    body: JSON.stringify({ messages } satisfies ChatRequest),
  });
  if (res.status === 503) {
    throw new ChatNotConfiguredError();
  }
  if (!res.ok) {
    throw new Error(await errorMessage(res));
  }
  return (await res.json()) as ChatResponse;
}

/**
 * Build a full error message from a failed response: the server's
 * `error`/`message` fields when the body is JSON, otherwise the raw body
 * text — always prefixed with the status so nothing is reduced to just an
 * HTTP code.
 */
async function errorMessage(res: Response): Promise<string> {
  const raw = await res.text();
  let detail = raw.trim();
  try {
    const body = JSON.parse(raw) as { error?: string; message?: string };
    const parts = [body.error, body.message].filter(Boolean);
    if (parts.length > 0) detail = parts.join(': ');
  } catch {
    // Non-JSON body; surface the raw text as-is.
  }
  return detail ? `HTTP ${res.status}: ${detail}` : `HTTP ${res.status}`;
}
