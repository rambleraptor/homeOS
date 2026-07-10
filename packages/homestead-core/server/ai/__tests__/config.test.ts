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
} from '../config';
import type { AiProvider } from '../../../apps/config';

afterEach(() => {
  setAiConfig(null);
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
