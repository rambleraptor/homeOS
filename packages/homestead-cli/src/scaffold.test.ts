import { test, expect } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  aiChoiceFor,
  appNames,
  inferAiFromEnv,
  parseAiProvider,
  parseEnvKeys,
  scaffold,
  scaffoldApp,
} from './scaffold.ts';

test('scaffold writes a project the launcher can resolve', () => {
  const parent = mkdtempSync(join(tmpdir(), 'hs-scaffold-'));
  const dir = join(parent, 'My Home!');
  try {
    const root = scaffold(dir);
    expect(existsSync(join(root, 'homestead.config.ts'))).toBe(true);
    expect(existsSync(join(root, 'apps', 'README.md'))).toBe(true);
    expect(readFileSync(join(root, '.gitignore'), 'utf8')).toContain('node_modules/');

    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      name: string;
      private: boolean;
      dependencies: Record<string, string>;
    };
    // Sanitized to a valid npm name.
    expect(pkg.name).toBe('my-home');
    expect(pkg.private).toBe(true);
    // Everything resolveServerModule / spa-build need must be declared.
    for (const dep of [
      '@rambleraptor/homestead-server',
      '@rambleraptor/homestead-app',
      '@rambleraptor/homestead-apps',
      '@rambleraptor/homestead-core',
    ]) {
      expect(pkg.dependencies[dep]).toBeDefined();
    }
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test('scaffold refuses to clobber an existing project', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hs-scaffold-'));
  try {
    writeFileSync(join(dir, 'homestead.config.ts'), '// existing');
    expect(() => scaffold(dir)).toThrow(/already exists/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('scaffold tolerates unrelated files and keeps an existing .gitignore', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hs-scaffold-'));
  try {
    writeFileSync(join(dir, '.env'), 'ANTHROPIC_API_KEY=sk-test\n');
    writeFileSync(join(dir, '.gitignore'), '# mine\ncustom-ignore\n');
    const root = scaffold(dir);
    // Generated files land alongside the pre-existing ones.
    expect(existsSync(join(root, 'homestead.config.ts'))).toBe(true);
    // The operator's own .gitignore is left untouched.
    expect(readFileSync(join(root, '.gitignore'), 'utf8')).toBe('# mine\ncustom-ignore\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('scaffold wires an ai block into homestead.config.ts when given a choice', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hs-scaffold-'));
  try {
    const root = scaffold(dir, {
      ai: { provider: 'anthropic', model: 'claude-3-5-sonnet-latest', keyEnv: 'ANTHROPIC_API_KEY' },
    });
    const config = readFileSync(join(root, 'homestead.config.ts'), 'utf8');
    expect(config).toContain("provider: 'anthropic'");
    expect(config).toContain("model: 'claude-3-5-sonnet-latest'");
    expect(config).toContain('process.env.ANTHROPIC_API_KEY');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('scaffold omits the ai block by default', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hs-scaffold-'));
  try {
    const config = readFileSync(join(scaffold(dir), 'homestead.config.ts'), 'utf8');
    expect(config).not.toContain('ai: {');
    expect(config).not.toContain('provider:');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('parseEnvKeys handles comments, export prefixes, and quoted values', () => {
  const keys = parseEnvKeys(
    ['# a comment', '', 'OPENAI_API_KEY=plain', 'export FOO="quoted"', "BAR='single'"].join('\n'),
  );
  expect(keys.get('OPENAI_API_KEY')).toBe('plain');
  expect(keys.get('FOO')).toBe('quoted');
  expect(keys.get('BAR')).toBe('single');
});

test('inferAiFromEnv maps a known key to its provider', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hs-env-'));
  try {
    expect(inferAiFromEnv(dir)).toBeNull(); // no .env
    writeFileSync(join(dir, '.env'), 'GEMINI_API_KEY=abc123\n');
    const ai = inferAiFromEnv(dir);
    expect(ai?.provider).toBe('google');
    expect(ai?.keyEnv).toBe('GEMINI_API_KEY');
    expect(ai?.model).toBe('gemini-2.5-flash');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('inferAiFromEnv ignores an empty key value', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hs-env-'));
  try {
    writeFileSync(join(dir, '.env'), 'ANTHROPIC_API_KEY=\n');
    expect(inferAiFromEnv(dir)).toBeNull();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('aiChoiceFor applies defaults and honors overrides', () => {
  expect(aiChoiceFor('openai')).toEqual({
    provider: 'openai',
    model: 'gpt-4o',
    keyEnv: 'OPENAI_API_KEY',
  });
  expect(aiChoiceFor('openai', { model: 'gpt-4o-mini', keyEnv: 'MY_KEY' })).toEqual({
    provider: 'openai',
    model: 'gpt-4o-mini',
    keyEnv: 'MY_KEY',
  });
});

test('parseAiProvider rejects unknown providers', () => {
  expect(parseAiProvider('google')).toBe('google');
  expect(() => parseAiProvider('cohere')).toThrow(/unknown AI provider/);
});

test('appNames derives every variant from a multi-word name', () => {
  const n = appNames('Meal Planners');
  expect(n.slug).toBe('meal-planners');
  expect(n.display).toBe('Meal Planners');
  expect(n.pascal).toBe('MealPlanners');
  expect(n.camel).toBe('mealPlanners');
  expect(n.singular).toBe('meal-planner'); // trailing "s" trimmed
  expect(n.singularPascal).toBe('MealPlanner');
  expect(n.pluralConst).toBe('MEAL_PLANNERS');
});

test('appNames splits camelCase input and rejects empty names', () => {
  expect(appNames('giftCards').slug).toBe('gift-cards');
  expect(() => appNames('   ')).toThrow(/no usable/);
});

test('scaffoldApp writes a skeleton app that auto-discovery picks up', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'hs-app-'));
  try {
    const { dir, names } = scaffoldApp('Book Shelf', cwd);
    expect(dir).toBe(join(cwd, 'apps', 'book-shelf'));
    expect(names.camel).toBe('bookShelf');

    const config = readFileSync(join(dir, 'app.homestead.ts'), 'utf8');
    expect(config).toContain("export const bookShelfApp: AppConfig");
    expect(config).toContain("id: 'book-shelf'");
    expect(config).toContain("basePath: '/book-shelf'");
    expect(config).toContain('BookShelfHome');
    // The starter resource is defined inline on the AppConfig.
    expect(config).toContain("singular: 'book-shelf'");
    expect(config).toContain("plural: 'book-shelf'");
    // Discovery requires the default export.
    expect(config).toContain('export default bookShelfApp');

    expect(existsSync(join(dir, 'components', 'BookShelfHome.tsx'))).toBe(true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('scaffoldApp refuses an existing app directory', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'hs-app-'));
  try {
    scaffoldApp('todos', cwd);
    expect(() => scaffoldApp('todos', cwd)).toThrow(/already exists/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
