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
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // Non-JSON error body; keep the status message.
    }
    throw new Error(message);
  }
  return (await res.json()) as ChatResponse;
}
