import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

/**
 * Scaffold a starter Homestead project: homestead.config.ts, a package.json
 * declaring the homestead packages (the launcher resolves the server, the SPA
 * shell, and vite through the project's node_modules), and an apps/ directory.
 * Refuses to write into a non-empty directory.
 */
export function scaffold(dir: string): string {
  const root = resolve(dir);
  mkdirSync(root, { recursive: true });

  for (const entry of readdirSync(root)) {
    if (entry !== '.' && entry !== '..') {
      throw new Error(`${root} is not empty — pick a fresh directory`);
    }
  }

  const files: Array<[string, string]> = [
    [join(root, 'homestead.config.ts'), CONFIG_TS],
    [join(root, 'package.json'), packageJson(root)],
    [join(root, 'apps', 'README.md'), APPS_README],
    [join(root, '.gitignore'), GITIGNORE],
  ];
  for (const [path, body] of files) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
  }
  return root;
}

/**
 * Version range for the scaffolded homestead packages. `*` until the packages
 * are published with real versions — tighten to a caret range then.
 */
const HOMESTEAD_VERSION_RANGE = '*';

function packageJson(root: string): string {
  // npm package-name rules: lowercase, no spaces; fall back when the
  // directory name has nothing usable.
  const name =
    basename(root)
      .toLowerCase()
      .replace(/[^a-z0-9-_.]+/g, '-')
      .replace(/^[-_.]+|[-_.]+$/g, '') || 'my-homestead';
  const pkg = {
    name,
    private: true,
    type: 'module',
    dependencies: {
      '@rambleraptor/homestead-app': HOMESTEAD_VERSION_RANGE,
      '@rambleraptor/homestead-apps': HOMESTEAD_VERSION_RANGE,
      '@rambleraptor/homestead-core': HOMESTEAD_VERSION_RANGE,
      '@rambleraptor/homestead-server': HOMESTEAD_VERSION_RANGE,
    },
  };
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

const CONFIG_TS = `/**
 * Homestead instance configuration.
 *
 * This is the ONE file you edit to choose what your homestead serves.
 * Comment out an app to remove it; import a new one to add it.
 *
 * To add a custom app, drop a .ts file under ./apps/ exporting an
 * AppConfig, then add the import + array entry below.
 */

import {
  dashboardApp,
  giftCardsApp,
  groceriesApp,
  recipesApp,
  todosApp,
} from '@rambleraptor/homestead-apps';
import type { HomesteadConfig } from '@rambleraptor/homestead-core/apps/config';

const config: HomesteadConfig = {
  apps: [
    dashboardApp,
    todosApp,
    giftCardsApp,
    groceriesApp,
    recipesApp,
  ],
};

// Tip: make this directory a git checkout and \`homestead update\` will
// fast-forward it to its upstream (origin/main, or whatever \`git branch -u\`
// says) and restart the service — handy for editing config from a phone.

export default config;
`;

const APPS_README = `# Custom Apps

Drop .ts files in this directory and import them from
\`../homestead.config.ts\` to add custom features to your Homestead instance.
`;

const GITIGNORE = `# Local server data (sqlite db + uploaded files)
data/

# Dependencies
node_modules/

# Launcher cache
.homestead/
`;
