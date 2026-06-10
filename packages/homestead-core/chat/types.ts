/**
 * Shared request/response shapes for the chat app.
 *
 * Types only — imported by both the client (`chat/api.ts`, hooks) and
 * the server handler (`server/chat/`), so nothing here may carry a
 * runtime import.
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * One tool invocation the assistant made while answering, surfaced to
 * the UI so the user can see what was read or changed.
 */
export interface ChatToolCall {
  /** Tool name, e.g. `create_gift_card`. */
  tool: string;
  args: Record<string, unknown>;
  ok: boolean;
  /** aepbase response on success. */
  result?: unknown;
  /** Error message on failure. */
  error?: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
}

export interface ChatResponse {
  reply: string;
  toolCalls: ChatToolCall[];
}
