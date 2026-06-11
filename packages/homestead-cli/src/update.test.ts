import { test, expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { needsUpdate, trackedUpstream } from './update.ts';

test('needsUpdate is false only when the two commits match', () => {
  expect(needsUpdate('abc123', 'abc123')).toBe(false);
  expect(needsUpdate('abc123', 'def456')).toBe(true);
  expect(needsUpdate('', 'def456')).toBe(true);
});

function git(cwd: string, ...args: string[]): void {
  const p = Bun.spawnSync({ cmd: ['git', ...args], cwd, stdout: 'ignore', stderr: 'pipe' });
  if (p.exitCode !== 0) {
    throw new Error(`git ${args.join(' ')}: ${new TextDecoder().decode(p.stderr)}`);
  }
}

test('trackedUpstream falls back to origin/main without a configured upstream', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hs-upstream-'));
  try {
    git(dir, 'init', '-b', 'main');
    expect(trackedUpstream(dir)).toEqual({ remote: 'origin', branch: 'main' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('trackedUpstream reads the checkout’s configured upstream', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hs-upstream-'));
  try {
    git(dir, 'init', '-b', 'config');
    git(dir, 'config', 'branch.config.remote', 'phone');
    git(dir, 'config', 'branch.config.merge', 'refs/heads/household');
    expect(trackedUpstream(dir)).toEqual({ remote: 'phone', branch: 'household' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
