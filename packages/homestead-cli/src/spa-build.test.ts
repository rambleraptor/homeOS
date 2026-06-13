import { test, expect } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spaBuildId } from './spa-build.ts';

function freshProject(): string {
  const root = mkdtempSync(join(tmpdir(), 'hs-spa-build-'));
  writeFileSync(join(root, 'homestead.config.ts'), 'export default { apps: [] };\n');
  writeFileSync(join(root, 'package.json'), '{}\n');
  return root;
}

test('buildId is stable for an unchanged project, with or without apps/', () => {
  const root = freshProject();
  try {
    const before = spaBuildId(root);
    expect(spaBuildId(root)).toBe(before);

    // An empty apps/ dir contributes nothing.
    mkdirSync(join(root, 'apps'));
    expect(spaBuildId(root)).toBe(before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildId changes when an app is added, edited, or removed', () => {
  const root = freshProject();
  try {
    const empty = spaBuildId(root);

    const appDir = join(root, 'apps', 'demo');
    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(appDir, 'app.homestead.ts'), 'export default { id: "demo" };\n');
    const added = spaBuildId(root);
    expect(added).not.toBe(empty);

    // Any file in the tree feeds the hash — component edits rebuild too.
    mkdirSync(join(appDir, 'components'));
    writeFileSync(join(appDir, 'components', 'Home.tsx'), 'export const Home = 1;\n');
    const withComponent = spaBuildId(root);
    expect(withComponent).not.toBe(added);

    writeFileSync(join(appDir, 'components', 'Home.tsx'), 'export const Home = 2;\n');
    expect(spaBuildId(root)).not.toBe(withComponent);

    rmSync(join(root, 'apps'), { recursive: true, force: true });
    expect(spaBuildId(root)).toBe(empty);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildId changes when the config changes', () => {
  const root = freshProject();
  try {
    const before = spaBuildId(root);
    writeFileSync(join(root, 'homestead.config.ts'), 'export default { apps: [/*x*/] };\n');
    expect(spaBuildId(root)).not.toBe(before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
