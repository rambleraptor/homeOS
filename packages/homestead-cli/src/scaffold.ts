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

Run \`homestead init-app <name>\` to scaffold a new app skeleton here.
`;

/** Names derived from a raw app name, used across the scaffolded files. */
export interface AppNames {
  /** kebab-case identifier: directory name, AppConfig.id, and basePath. */
  slug: string;
  /** Title Case display name (AppConfig.name). */
  display: string;
  /** PascalCase, e.g. for the home component (`<Pascal>Home`). */
  pascal: string;
  /** camelCase export base; the exported config is `<camel>App`. */
  camel: string;
  /** kebab-case resource singular (slug with a trailing "s" trimmed). */
  singular: string;
  /** PascalCase of the singular — the record interface name. */
  singularPascal: string;
  /** SCREAMING_SNAKE constant naming the collection plural. */
  pluralConst: string;
}

/** Split a raw name into lowercase word tokens (letters + digits). */
function words(raw: string): string[] {
  return raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // split camelCase
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function pascal(tokens: string[]): string {
  return tokens.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

/** Derive every name variant the app skeleton needs from a raw input. */
export function appNames(raw: string): AppNames {
  const tokens = words(raw);
  if (tokens.length === 0) {
    throw new Error(`"${raw}" has no usable letters or digits for an app name`);
  }
  const slug = tokens.join('-');
  const singularTokens = [...tokens];
  const last = singularTokens[singularTokens.length - 1];
  if (last.length > 1 && last.endsWith('s')) {
    singularTokens[singularTokens.length - 1] = last.slice(0, -1);
  }
  const camelHead = tokens[0];
  const camel = camelHead + pascal(tokens.slice(1));
  return {
    slug,
    display: tokens.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    pascal: pascal(tokens),
    camel,
    singular: singularTokens.join('-'),
    singularPascal: pascal(singularTokens),
    pluralConst: tokens.join('_').toUpperCase(),
  };
}

/**
 * Scaffold a custom app skeleton under `<cwd>/apps/<slug>/`: an AppConfig
 * (`app.config.ts`), a starter resource definition (`resources.ts`), record
 * types (`types.ts`), a home component, and a barrel `index.ts`. Refuses to
 * overwrite an existing app directory. Returns the names so the caller can
 * print wiring instructions for `homestead.config.ts`.
 */
export function scaffoldApp(raw: string, cwd = '.'): { dir: string; names: AppNames } {
  const names = appNames(raw);
  const dir = resolve(cwd, 'apps', names.slug);
  if (existsSync(dir)) {
    throw new Error(`apps/${names.slug} already exists — pick a different name`);
  }

  const files: Array<[string, string]> = [
    [join(dir, 'app.config.ts'), appConfigTs(names)],
    [join(dir, 'resources.ts'), appResourcesTs(names)],
    [join(dir, 'types.ts'), appTypesTs(names)],
    [join(dir, 'components', `${names.pascal}Home.tsx`), appHomeTsx(names)],
    [join(dir, 'index.ts'), appIndexTs(names)],
  ];
  for (const [path, body] of files) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
  }
  return { dir, names };
}

function appConfigTs(n: AppNames): string {
  return `/**
 * ${n.display} App Configuration
 */

import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';
import { ${n.camel}Resources } from './resources';

export const ${n.camel}App: AppConfig = {
  id: '${n.slug}',
  name: '${n.display}',
  description: 'TODO: describe what ${n.display} does.',
  icon: () => import('lucide-react').then((m) => m.Package),
  basePath: '/${n.slug}',
  routes: [
    {
      path: '',
      index: true,
      component: () =>
        import('./components/${n.pascal}Home').then((m) => m.${n.pascal}Home),
    },
  ],
  showInNav: true,
  navOrder: 100,
  enabled: true,
  defaultEnabled: 'all',
  resources: ${n.camel}Resources,
};
`;
}

function appResourcesTs(n: AppNames): string {
  return `import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';

/**
 * Collection plural identifiers — the URL segment aepbase uses for each
 * resource. Import these from hooks so renaming a collection is a one-file
 * change.
 */
export const ${n.pluralConst} = '${n.slug}' as const;

export const ${n.camel}Resources: ResourceDefinition[] = [
  {
    singular: '${n.singular}',
    plural: ${n.pluralConst},
    description: 'TODO: describe this resource.',
    user_settable_create: true,
    fields: {
      name: { type: 'string', description: 'Display name.', required: true },
      created_by: { type: 'string', description: 'users/{user_id}' },
    },
  },
];
`;
}

function appTypesTs(n: AppNames): string {
  return `/**
 * ${n.display} App Types
 */

/**
 * A ${n.singular} record from aepbase. Matches the shape declared in
 * \`./resources.ts\`.
 */
export interface ${n.singularPascal} {
  id: string;
  path: string;
  name: string;
  created_by?: string;
  create_time: string;
  update_time: string;
}
`;
}

function appHomeTsx(n: AppNames): string {
  return `/**
 * ${n.display} home page. Rendered at the app's index route (\`/${n.slug}\`).
 *
 * Fetch data with hooks built on the aepbase client
 * (\`@rambleraptor/homestead-core/api/aepbase\`) and the collection constants
 * in \`../resources\`.
 */
export function ${n.pascal}Home() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">${n.display}</h1>
      <p className="mt-2 text-gray-600">
        Your new app starts here. Edit
        <code className="mx-1">apps/${n.slug}/components/${n.pascal}Home.tsx</code>
        to build it out.
      </p>
    </div>
  );
}
`;
}

function appIndexTs(n: AppNames): string {
  return `/**
 * ${n.display} App Exports
 */

export { ${n.camel}App } from './app.config';
export type { ${n.singularPascal} } from './types';
`;
}

const GITIGNORE = `# Local server data (sqlite db + uploaded files)
data/

# Dependencies
node_modules/

# Launcher cache
.homestead/
`;
