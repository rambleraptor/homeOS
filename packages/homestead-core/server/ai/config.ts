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
import type { EmbeddingModel, LanguageModel } from 'ai';
import type { AiConfig, EmbeddingConfig } from '../../apps/config';

let current: AiConfig | null = null;
let currentEmbedding: EmbeddingConfig | null = null;

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

// ----------------------------------------------------------------------------
// Embedding provider — separate block; Anthropic has no embedding model.
// ----------------------------------------------------------------------------

/** True when `cfg` carries a usable, non-empty API key. */
function hasEmbeddingKey(cfg: EmbeddingConfig | null): cfg is EmbeddingConfig {
  return cfg !== null && cfg.auth.apiKey.trim() !== '';
}

/**
 * Install the instance's embedding config. Called once by the server at startup
 * with `registry.embeddingConfig()` (null when the operator omitted the
 * `embedding` block). Safe to call with `null` to leave embedding disabled.
 */
export function setEmbeddingConfig(config: EmbeddingConfig | null): void {
  currentEmbedding = config;
}

/** The active embedding config, or null when embedding is unconfigured. */
export function getEmbeddingConfig(): EmbeddingConfig | null {
  return currentEmbedding;
}

/**
 * True when an embedding provider is configured. Semantic search over
 * `ai.embed` file fields requires this in addition to {@link isAiConfigured}
 * (extraction still needs the language model).
 */
export function isEmbeddingConfigured(): boolean {
  return hasEmbeddingKey(currentEmbedding);
}

/** Thrown by {@link getEmbeddingModel} when no embedding provider is configured. */
export class EmbeddingNotConfiguredError extends Error {
  constructor() {
    super('Embedding is not configured on the server');
    this.name = 'EmbeddingNotConfiguredError';
  }
}

/**
 * Instantiate the configured embedding model. `modelOverride` lets a single
 * field pin a different model via `ai.embed.embedding_model`; it must be a
 * model of the *same* configured provider (there's one embedding provider per
 * instance). Throws {@link EmbeddingNotConfiguredError} when unconfigured.
 */
export function getEmbeddingModel(modelOverride?: string): EmbeddingModel {
  const cfg = currentEmbedding;
  if (!hasEmbeddingKey(cfg)) throw new EmbeddingNotConfiguredError();

  const { apiKey } = cfg.auth;
  const { baseURL } = cfg;
  const model = modelOverride || cfg.model;
  switch (cfg.provider) {
    case 'openai':
      return createOpenAI({ apiKey, baseURL }).textEmbeddingModel(model);
    case 'google':
      return createGoogleGenerativeAI({ apiKey, baseURL }).textEmbeddingModel(model);
  }
}
