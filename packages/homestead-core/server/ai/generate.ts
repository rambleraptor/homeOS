/**
 * The unified server-side AI API.
 *
 * Every AI call in Homestead goes through one of these three primitives, so the
 * provider/model is chosen once (in homestead.config.ts) and no call site talks
 * to a provider SDK directly:
 *
 * - {@link aiGenerateText}   — plain or multimodal text completion.
 * - {@link aiGenerateObject} — schema-validated structured output.
 * - {@link aiRunAgent}       — a tool-calling agentic loop (the chat assistant).
 *
 * Each resolves the configured model via {@link getAiModel}; callers should gate
 * on {@link isAiConfigured} and return 503 first when AI may be unconfigured.
 */

import {
  generateText,
  generateObject,
  stepCountIs,
  type ModelMessage,
  type StepResult,
  type ToolSet,
} from 'ai';
import type { z } from 'zod';
import { getAiModel } from './config';

// Re-exported so call sites build messages/tools from a single import surface.
export type { ModelMessage, ToolSet } from 'ai';
export { tool } from 'ai';

/**
 * The model's input: either a plain text `prompt` or a `messages` array (used
 * for history and multimodal/image parts). The SDK requires exactly one, so we
 * build it here rather than passing both as possibly-undefined.
 */
function promptInput(opts: { prompt?: string; messages?: ModelMessage[] }):
  | { messages: ModelMessage[] }
  | { prompt: string } {
  return opts.messages !== undefined
    ? { messages: opts.messages }
    : { prompt: opts.prompt ?? '' };
}

/** Plain or multimodal text completion. Returns the model's text reply. */
export async function aiGenerateText(opts: {
  system?: string;
  prompt?: string;
  messages?: ModelMessage[];
}): Promise<string> {
  const { text } = await generateText({
    model: getAiModel(),
    system: opts.system,
    ...promptInput(opts),
  });
  return text;
}

/**
 * Structured generation validated against a Zod schema. Returns the parsed
 * object, typed to the schema. Image parts (for vision extraction) go in
 * `messages`.
 */
export async function aiGenerateObject<T>(opts: {
  system?: string;
  prompt?: string;
  messages?: ModelMessage[];
  schema: z.ZodType<T>;
}): Promise<T> {
  const { object } = await generateObject({
    model: getAiModel(),
    schema: opts.schema,
    system: opts.system,
    ...promptInput(opts),
  });
  return object;
}

/**
 * Run a tool-calling agentic turn. The SDK invokes each tool's `execute` and
 * feeds the result back to the model, looping up to `maxRounds` model steps
 * before returning the final text. Returns the text plus the per-step record
 * (tool calls/results) for callers that need it.
 */
export async function aiRunAgent<TOOLS extends ToolSet>(opts: {
  system: string;
  messages: ModelMessage[];
  tools: TOOLS;
  maxRounds: number;
}): Promise<{ text: string; steps: StepResult<TOOLS>[] }> {
  const { text, steps } = await generateText({
    model: getAiModel(),
    system: opts.system,
    messages: opts.messages,
    tools: opts.tools,
    stopWhen: stepCountIs(opts.maxRounds),
  });
  return { text, steps };
}
