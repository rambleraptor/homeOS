/**
 * Tests for AI provider selection. These never hit the network — instantiating
 * a provider model only builds a spec object.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  setAiConfig,
  getAiConfig,
  isAiConfigured,
  getAiModel,
  AiNotConfiguredError,
  setEmbeddingConfig,
  getEmbeddingConfig,
  isEmbeddingConfigured,
  getEmbeddingModel,
  EmbeddingNotConfiguredError,
} from '../config';
import type { AiProvider, EmbeddingProvider } from '../../../apps/config';

afterEach(() => {
  setAiConfig(null);
  setEmbeddingConfig(null);
});

describe('AI config', () => {
  it('reports unconfigured by default and throws from getAiModel', () => {
    setAiConfig(null);
    expect(isAiConfigured()).toBe(false);
    expect(getAiConfig()).toBeNull();
    expect(() => getAiModel()).toThrow(AiNotConfiguredError);
  });

  it('instantiates a model for each supported provider', () => {
    const providers: AiProvider[] = ['openai', 'anthropic', 'google'];
    for (const provider of providers) {
      setAiConfig({ provider, model: 'test-model', auth: { apiKey: 'fake-key' } });
      expect(isAiConfigured()).toBe(true);
      // A LanguageModel is an object (or string id); just assert we got one.
      expect(getAiModel()).toBeTruthy();
    }
  });

  it('treats a blank apiKey as unconfigured (no SDK env fallback)', () => {
    // An `ai` block whose key resolves to '' (e.g. its env var is unset in
    // homestead.config.ts) must report unconfigured, so callers 503 rather
    // than letting the provider SDK reach for its own env var.
    setAiConfig({ provider: 'google', model: 'gemini-2.5-flash', auth: { apiKey: '' } });
    expect(isAiConfigured()).toBe(false);
    expect(() => getAiModel()).toThrow(AiNotConfiguredError);

    setAiConfig({ provider: 'google', model: 'gemini-2.5-flash', auth: { apiKey: '   ' } });
    expect(isAiConfigured()).toBe(false);
    expect(() => getAiModel()).toThrow(AiNotConfiguredError);
  });

  it('round-trips the active config', () => {
    const cfg = {
      provider: 'anthropic' as const,
      model: 'claude-3-5-sonnet-latest',
      auth: { apiKey: 'k' },
    };
    setAiConfig(cfg);
    expect(getAiConfig()).toEqual(cfg);
  });
});

describe('embedding config', () => {
  it('is independent of the chat config and unconfigured by default', () => {
    setAiConfig({ provider: 'anthropic', model: 'claude', auth: { apiKey: 'k' } });
    // Chat configured, but embedding is a separate block — still off.
    expect(isAiConfigured()).toBe(true);
    expect(isEmbeddingConfigured()).toBe(false);
    expect(getEmbeddingConfig()).toBeNull();
    expect(() => getEmbeddingModel()).toThrow(EmbeddingNotConfiguredError);
  });

  it('instantiates an embedding model for each embedding provider', () => {
    const providers: EmbeddingProvider[] = ['openai', 'google'];
    for (const provider of providers) {
      setEmbeddingConfig({ provider, model: 'test-embed', auth: { apiKey: 'fake-key' } });
      expect(isEmbeddingConfigured()).toBe(true);
      expect(getEmbeddingModel()).toBeTruthy();
    }
  });

  it('honors a per-field model override', () => {
    setEmbeddingConfig({ provider: 'openai', model: 'text-embedding-3-small', auth: { apiKey: 'k' } });
    // Override resolves without throwing (same provider, different model id).
    expect(getEmbeddingModel('text-embedding-3-large')).toBeTruthy();
  });

  it('treats a blank apiKey as unconfigured', () => {
    setEmbeddingConfig({ provider: 'openai', model: 'text-embedding-3-small', auth: { apiKey: '  ' } });
    expect(isEmbeddingConfigured()).toBe(false);
    expect(() => getEmbeddingModel()).toThrow(EmbeddingNotConfiguredError);
  });
});
