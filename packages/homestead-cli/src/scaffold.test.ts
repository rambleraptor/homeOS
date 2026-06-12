import { test, expect } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appNames, scaffold, scaffoldApp } from './scaffold.ts';

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

test('scaffold refuses a non-empty directory', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hs-scaffold-'));
  try {
    writeFileSync(join(dir, 'existing.txt'), 'hi');
    expect(() => scaffold(dir)).toThrow(/not empty/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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

test('scaffoldApp writes a skeleton app the config can import', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'hs-app-'));
  try {
    const { dir, names } = scaffoldApp('Book Shelf', cwd);
    expect(dir).toBe(join(cwd, 'apps', 'book-shelf'));
    expect(names.camel).toBe('bookShelf');

    const config = readFileSync(join(dir, 'app.config.ts'), 'utf8');
    expect(config).toContain("export const bookShelfApp: AppConfig");
    expect(config).toContain("id: 'book-shelf'");
    expect(config).toContain("basePath: '/book-shelf'");
    expect(config).toContain('BookShelfHome');

    expect(existsSync(join(dir, 'resources.ts'))).toBe(true);
    expect(existsSync(join(dir, 'types.ts'))).toBe(true);
    expect(existsSync(join(dir, 'components', 'BookShelfHome.tsx'))).toBe(true);

    const index = readFileSync(join(dir, 'index.ts'), 'utf8');
    expect(index).toContain("export { bookShelfApp } from './app.config'");
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
