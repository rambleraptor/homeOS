/**
 * Tests for email provider selection. These never hit the network —
 * constructing a provider only builds an object; no token is minted until a
 * method is called.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  setEmailConfig,
  getEmailConfig,
  isEmailConfigured,
  getEmailProvider,
  EmailNotConfiguredError,
} from '../config';
import { EmailProvider } from '../types';
import { GmailProvider } from '../gmail';
import type { EmailConfig } from '../../../apps/config';

const validConfig: EmailConfig = {
  provider: 'gmail',
  auth: { clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh' },
};

afterEach(() => {
  setEmailConfig(null);
});

describe('email config', () => {
  it('reports unconfigured by default and throws from getEmailProvider', () => {
    setEmailConfig(null);
    expect(isEmailConfigured()).toBe(false);
    expect(getEmailConfig()).toBeNull();
    expect(() => getEmailProvider()).toThrow(EmailNotConfiguredError);
  });

  it('builds a Gmail provider when configured', () => {
    setEmailConfig(validConfig);
    expect(isEmailConfigured()).toBe(true);
    const provider = getEmailProvider();
    expect(provider).toBeInstanceOf(GmailProvider);
    expect(provider).toBeInstanceOf(EmailProvider);
  });

  it('memoizes the provider instance across calls', () => {
    setEmailConfig(validConfig);
    expect(getEmailProvider()).toBe(getEmailProvider());
  });

  it('rebuilds the provider when the config changes', () => {
    setEmailConfig(validConfig);
    const first = getEmailProvider();
    setEmailConfig({ ...validConfig, user: 'someone@example.com' });
    expect(getEmailProvider()).not.toBe(first);
  });

  it.each([
    ['clientId', { clientId: '', clientSecret: 's', refreshToken: 'r' }],
    ['clientSecret', { clientId: 'i', clientSecret: '  ', refreshToken: 'r' }],
    ['refreshToken', { clientId: 'i', clientSecret: 's', refreshToken: '' }],
  ])('treats a blank %s as unconfigured', (_label, auth) => {
    setEmailConfig({ provider: 'gmail', auth });
    expect(isEmailConfigured()).toBe(false);
    expect(() => getEmailProvider()).toThrow(EmailNotConfiguredError);
  });

  it('round-trips the active config', () => {
    setEmailConfig(validConfig);
    expect(getEmailConfig()).toEqual(validConfig);
  });
});
