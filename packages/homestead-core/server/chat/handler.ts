/**
 * Chat backend: `POST /api/chat` (mounted by the sidecar).
 *
 * Runs a Gemini chat turn with one CRUD tool per registered aepbase
 * resource. Tool calls execute against aepbase with the caller's own
 * token, so they can only do what the user could do directly.
 * Conversations are ephemeral — the client sends the full transcript
 * each turn and nothing is persisted server-side.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Part } from '@google/generative-ai';
import { authenticate, type AuthedUser } from '../aepbase';
import { getAllResourceDefs } from '../../apps/registry';
import { BUILTIN_RESOURCE_DEFS } from '../../resources/builtins';
import { logger } from '../../utils/logger';
import type {
  ChatMessage,
  ChatResponse,
  ChatToolCall,
} from '../../chat/types';
import { buildTools } from './tools';
import { executeToolCall } from './execute';

const GEMINI_MODEL = 'gemini-2.5-flash';

/** Max rounds of tool execution per turn before forcing a text answer. */
const MAX_TOOL_ROUNDS = 10;

function buildSystemPrompt(user: AuthedUser): string {
  return [
    'You are the Homestead household assistant. You help members of the',
    'household look up and manage their data (todos, groceries, recipes,',
    'gift cards, events, and more) using the provided tools.',
    '',
    `Today's date: ${new Date().toISOString().slice(0, 10)}.`,
    `Signed-in user: id "${user.id}", email "${user.email}"` +
      (user.display_name ? `, name "${user.display_name}"` : '') +
      '.',
    '',
    'Guidelines:',
    `- When a tool takes a "user_id" parameter (notifications, preferences,`,
    `  and other user-scoped data), use the signed-in user's id above. You`,
    '  can only act on data the signed-in user can access.',
    '- Record ids are server-assigned. When you are not sure of an id, read',
    '  (list) the collection first instead of guessing.',
    '- Updates are merge patches: send only the fields to change.',
    '- Deletes cannot be undone. Before deleting, confirm with the user',
    '  unless they have already clearly identified the exact record.',
    '- Answer in plain text, concisely. Summarize what you changed.',
  ].join('\n');
}

function badRequest(message: string): Response {
  return Response.json({ error: 'Bad request', message }, { status: 400 });
}

function isValidMessage(m: unknown): m is ChatMessage {
  if (typeof m !== 'object' || m === null) return false;
  const { role, content } = m as Record<string, unknown>;
  return (role === 'user' || role === 'assistant') && typeof content === 'string';
}

export async function handleChat(request: Request): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error: 'Service unavailable',
        message: 'Gemini API is not configured on the server',
      },
      { status: 503 },
    );
  }

  const auth = await authenticate(request);
  if (!auth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { messages?: unknown };
  try {
    body = (await request.json()) as { messages?: unknown };
  } catch {
    return badRequest('request body must be JSON');
  }
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return badRequest('messages must be a non-empty array');
  }
  if (!messages.every(isValidMessage)) {
    return badRequest('each message needs a user/assistant role and string content');
  }
  if (messages[messages.length - 1].role !== 'user') {
    return badRequest('the last message must be from the user');
  }

  // Same definition union the schema sync applies, so the model sees
  // every collection that exists in aepbase.
  const { declarations, bindings } = buildTools([
    ...BUILTIN_RESOURCE_DEFS,
    ...getAllResourceDefs(),
  ]);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    tools: [{ functionDeclarations: declarations }],
    systemInstruction: buildSystemPrompt(auth.user),
  });
  const chat = model.startChat({
    history: messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
  });

  try {
    const toolCalls: ChatToolCall[] = [];
    let result = await chat.sendMessage(messages[messages.length - 1].content);

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const calls = result.response.functionCalls();
      if (!calls || calls.length === 0) break;

      const responses: Part[] = [];
      for (const call of calls) {
        const outcome = await executeToolCall(call, bindings, auth.token);
        toolCalls.push(outcome);
        responses.push({
          functionResponse: {
            name: call.name,
            response: outcome.ok
              ? { result: outcome.result ?? null }
              : { error: outcome.error },
          },
        });
      }
      result = await chat.sendMessage(responses);
    }

    const response: ChatResponse = {
      reply: result.response.text(),
      toolCalls,
    };
    return Response.json(response);
  } catch (err) {
    logger.error('chat: Gemini request failed', err);
    return Response.json(
      {
        error: 'Bad gateway',
        message:
          err instanceof Error ? err.message : 'The Gemini request failed',
      },
      { status: 502 },
    );
  }
}
