import { describe, expect, it } from 'vitest';
import {
  UnsafeUrlError,
  isPublicAddress,
  parseHttpUrl,
  safeFetch,
} from '../net/safe-fetch';

describe('parseHttpUrl', () => {
  it('accepts http and https', () => {
    expect(parseHttpUrl('https://example.com/r').protocol).toBe('https:');
    expect(parseHttpUrl('http://example.com/r').protocol).toBe('http:');
  });

  it('trims surrounding whitespace', () => {
    expect(parseHttpUrl('  https://example.com/r  ').hostname).toBe('example.com');
  });

  it.each(['file:///etc/passwd', 'gopher://example.com', 'ftp://example.com'])(
    'rejects non-http scheme %s',
    (url) => {
      expect(() => parseHttpUrl(url)).toThrow(UnsafeUrlError);
    },
  );

  it('rejects a data: URL', () => {
    expect(() => parseHttpUrl('data:text/html,<h1>hi</h1>')).toThrow(UnsafeUrlError);
  });

  it('rejects embedded credentials', () => {
    expect(() => parseHttpUrl('https://user:pass@example.com/')).toThrow(
      /embedded credentials/i,
    );
  });

  it('rejects malformed input', () => {
    expect(() => parseHttpUrl('not a url')).toThrow(UnsafeUrlError);
  });
});

describe('isPublicAddress', () => {
  it.each([
    '1.1.1.1',
    '8.8.8.8',
    '93.184.216.34',
    '172.15.0.1', // just below the private 172.16/12 block
    '172.32.0.1', // just above it
    '100.63.0.1', // just below CGNAT 100.64/10
    '100.128.0.1', // just above it
  ])('accepts public IPv4 %s', (ip) => {
    expect(isPublicAddress(ip)).toBe(true);
  });

  it.each([
    ['loopback', '127.0.0.1'],
    ['loopback (whole /8)', '127.255.255.254'],
    ['private 10/8', '10.0.0.5'],
    ['private 172.16/12', '172.16.0.1'],
    ['private 172.16/12 top', '172.31.255.255'],
    ['private 192.168/16', '192.168.1.1'],
    ['link-local / cloud metadata', '169.254.169.254'],
    ['CGNAT', '100.64.0.1'],
    ['this-network', '0.0.0.0'],
    ['multicast', '224.0.0.1'],
    ['broadcast', '255.255.255.255'],
    ['benchmarking', '198.18.0.1'],
    ['TEST-NET-1', '192.0.2.1'],
  ])('rejects %s (%s)', (_label, ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });

  it.each([
    ['loopback', '::1'],
    ['unspecified', '::'],
    ['unique-local', 'fd00::1'],
    ['unique-local fc00', 'fc00::1'],
    ['link-local', 'fe80::1'],
    ['multicast', 'ff02::1'],
    ['documentation', '2001:db8::1'],
    ['6to4', '2002::1'],
    ['NAT64 well-known', '64:ff9b::7f00:1'],
  ])('rejects IPv6 %s (%s)', (_label, ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });

  it('accepts a public IPv6 address', () => {
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true);
  });

  it('sees through IPv4-mapped IPv6 to the underlying v4 rules', () => {
    expect(isPublicAddress('::ffff:127.0.0.1')).toBe(false);
    expect(isPublicAddress('::ffff:192.168.1.1')).toBe(false);
    expect(isPublicAddress('::ffff:8.8.8.8')).toBe(true);
  });

  it('ignores an IPv6 zone index', () => {
    expect(isPublicAddress('fe80::1%eth0')).toBe(false);
  });

  it('rejects anything that is not an IP', () => {
    expect(isPublicAddress('example.com')).toBe(false);
    expect(isPublicAddress('')).toBe(false);
  });
});

describe('safeFetch', () => {
  // These need no network: a literal address is range-checked before any
  // connection is attempted.
  it.each([
    'http://127.0.0.1:8080/api/aep',
    'http://169.254.169.254/latest/meta-data/',
    'http://192.168.1.1/admin',
    'http://10.0.0.5/',
    'http://[::1]:3000/',
  ])('refuses to fetch %s', async (url) => {
    await expect(safeFetch(url)).rejects.toThrow(UnsafeUrlError);
  });

  it('names the address it refused', async () => {
    await expect(safeFetch('http://169.254.169.254/')).rejects.toThrow(
      /169\.254\.169\.254/,
    );
  });

  it('rejects a non-http scheme before resolving anything', async () => {
    await expect(safeFetch('file:///etc/passwd')).rejects.toThrow(/only http/i);
  });
});
