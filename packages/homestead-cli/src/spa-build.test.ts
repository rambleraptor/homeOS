import { test, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spaDistDir } from './spa-build.ts';

test('spaDistDir is stable for a project and lands under the cache root', () => {
  const cache = mkdtempSync(join(tmpdir(), 'hs-cache-'));
  const root = mkdtempSync(join(tmpdir(), 'hs-proj-'));
  const prev = process.env.HOMESTEAD_CACHE_DIR;
  process.env.HOMESTEAD_CACHE_DIR = cache;
  try {
    const dist = spaDistDir(root);
    expect(spaDistDir(root)).toBe(dist);
    expect(dist.startsWith(join(cache, 'spa-builds'))).toBe(true);
  } finally {
    if (prev === undefined) delete process.env.HOMESTEAD_CACHE_DIR;
    else process.env.HOMESTEAD_CACHE_DIR = prev;
    rmSync(cache, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

test('spaDistDir differs per project', () => {
  const a = mkdtempSync(join(tmpdir(), 'hs-proj-a-'));
  const b = mkdtempSync(join(tmpdir(), 'hs-proj-b-'));
  try {
    expect(spaDistDir(a)).not.toBe(spaDistDir(b));
  } finally {
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  }
});
