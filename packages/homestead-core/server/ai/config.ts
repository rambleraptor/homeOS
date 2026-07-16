/**
 * AI provider configuration for the server.
 *
 * The operator declares an `ai` block in homestead.config.ts (provider, model,
 * credentials). The server reads it via `registry.aiConfig()` at startup and
 * pushes it here with {@link setAiConfig} — core can't import the server's
 * registry (the dependency direction is server → core), so the server hands the
 * config down instead. Every AI call site then resolves the configured model
 * through {@link getAiModel} rather than reading env vars itself.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import type { AiConfig } from '../../apps/config';

let current: AiConfig | null = null;

/** True when `cfg` carries a usable, non-empty API key. */
function hasApiKey(cfg: AiConfig | null): cfg is AiConfig {
  return cfg !== null && cfg.auth.apiKey.trim() !== '';
}

/**
 * Install the instance's AI config. Called once by the server at startup with
 * `registry.aiConfig()` (which is `null` when the operator omitted the `ai`
 * block). Safe to call with `null` to leave AI disabled.
 */
export function setAiConfig(config: AiConfig | null): void {
  current = config;
}

/** The active AI config, or null when AI is unconfigured. */
export function getAiConfig(): AiConfig | null {
  return current;
}

/**
 * True when an AI provider is configured for this instance. Requires a
 * non-empty `auth.apiKey`: an `ai` block whose key is blank (e.g. the env var
 * it reads in homestead.config.ts is unset) counts as unconfigured, so callers
 * return a clean 503 instead of letting the provider SDK fall back to its own
 * environment variable (`GOOGLE_GENERATIVE_AI_API_KEY`, `OPENAI_API_KEY`, …).
 */
export function isAiConfigured(): boolean {
  return hasApiKey(current);
}

/** Thrown by {@link getAiModel} when no AI provider is configured. */
export class AiNotConfiguredError extends Error {
  constructor() {
    super('AI is not configured on the server');
    this.name = 'AiNotConfiguredError';
  }
}

/**
 * Instantiate the configured provider's language model. Throws
 * {@link AiNotConfiguredError} when AI is unconfigured — callers should gate on
 * {@link isAiConfigured} and return 503 before reaching this.
 */
export function getAiModel(): LanguageModel {
  const cfg = current;
  if (!hasApiKey(cfg)) throw new AiNotConfiguredError();

  const { apiKey } = cfg.auth;
  // `baseURL: undefined` is the SDKs' own default, so passing it through
  // unconditionally keeps the cloud endpoints intact.
  const { baseURL } = cfg;
  switch (cfg.provider) {
    case 'openai':
      return createOpenAI({ apiKey, baseURL })(cfg.model);
    case 'anthropic':
      return createAnthropic({ apiKey, baseURL })(cfg.model);
    case 'google':
      return createGoogleGenerativeAI({ apiKey, baseURL })(cfg.model);
  }
}
