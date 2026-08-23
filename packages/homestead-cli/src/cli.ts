#!/usr/bin/env bun
import { parseArgs, type ParseArgsConfig } from 'node:util';
import { resolve } from 'node:path';
import { createInterface, type Interface as ReadlineInterface } from 'node:readline/promises';
import {
  scaffold,
  scaffoldApp,
  aiChoiceFor,
  inferAiFromEnv,
  parseAiProvider,
  resolveApps,
  AI_PROVIDER_DEFAULTS,
  APP_CATALOG,
  type AiChoice,
  type CatalogApp,
} from './scaffold.ts';
import { runDoctor, hasFailures, type Check } from './doctor.ts';
import { generateKeyCmd, resolveKeyLocation } from './key.ts';

async function main(argv: string[]): Promise<number> {
  const [sub, ...rest] = argv;
  switch (sub) {
    case undefined:
    case 'help':
    case '-h':
    case '--help':
      printUsage();
      return 0;
    case 'start':
      return startCmd(rest);
    case 'init':
      return initCmd(rest);
    case 'init-app':
      return initAppCmd(rest);
    case 'doctor':
      return doctorCmd(rest);
    case 'install-service':
      return installServiceCmd(rest);
    case 'resources': {
      // Lazy import: only `resources` pulls in aep-lib-ts + axios. It also
      // owns its own flag parsing (--@data etc.), so argv passes through raw.
      const { resourcesCmd } = await import('./resources.ts');
      return resourcesCmd(rest);
    }
    case 'login':
      return loginCmd(rest);
    case 'logout':
      return logoutCmd(rest);
    case 'profiles':
      return profilesCmd(rest);
    case 'admin':
      return adminCmd(rest);
    case 'key':
      return keyCmd(rest);
    case 'backup':
      return backupCmd(rest);
    case 'restore':
      return restoreCmd(rest);
    default:
      printUsage();
      console.error(`\nunknown subcommand ${JSON.stringify(sub)}`);
      return 1;
  }
}

type CliOptions = NonNullable<ParseArgsConfig['options']>;

/**
 * parseArgs in strict mode, with errors turned into a printed message +
 * `null` so commands can return exit code 1 instead of throwing.
 */
function parse(
  args: string[],
  options: CliOptions,
  { positionals = false } = {},
): { values: Record<string, string | boolean | undefined>; positionals: string[] } | null {
  try {
    const parsed = parseArgs({ args, options, strict: true, allowPositionals: positionals });
    return {
      values: parsed.values as Record<string, string | boolean | undefined>,
      positionals: parsed.positionals,
    };
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return null;
  }
}

async function startCmd(args: string[]): Promise<number> {
  const parsed = parse(args, {
    dev: { type: 'boolean', default: false },
    port: { type: 'string' },
    'data-dir': { type: 'string' },
  });
  if (!parsed) return 1;
  const { values } = parsed;
  const { runStart } = await import('./supervisor.ts');
  try {
    return await runStart('.', {
      dev: values.dev === true,
      frontendPort: numFlag(values.port, 3000),
      dataDir: strFlag(values['data-dir']),
    });
  } catch (err) {
    console.error(`[homestead] ${err instanceof Error ? err.message : err}`);
    return 1;
  }
}

async function adminCmd(args: string[]): Promise<number> {
  const parsed = parse(
    args,
    {
      'data-dir': { type: 'string' },
      email: { type: 'string' },
    },
    { positionals: true },
  );
  if (!parsed) return 1;
  if (parsed.positionals[0] !== 'reset-password') {
    console.error('usage: homestead admin reset-password [--email=EMAIL] [--data-dir=PATH]');
    return 1;
  }
  const { resetPasswordCmd } = await import('./admin.ts');
  return resetPasswordCmd({
    dataDir: strFlag(parsed.values['data-dir']),
    email: strFlag(parsed.values.email),
  });
}

async function loginCmd(args: string[]): Promise<number> {
  const parsed = parse(args, {
    server: { type: 'string' },
    email: { type: 'string' },
    password: { type: 'string' },
    profile: { type: 'string' },
    'set-default': { type: 'boolean', default: false },
  });
  if (!parsed) return 1;
  const { login } = await import('./login.ts');
  return login({
    server: strFlag(parsed.values.server),
    email: strFlag(parsed.values.email),
    password: strFlag(parsed.values.password),
    profile: strFlag(parsed.values.profile),
    setDefault: parsed.values['set-default'] === true,
  });
}

async function logoutCmd(args: string[]): Promise<number> {
  const parsed = parse(args, { profile: { type: 'string' } });
  if (!parsed) return 1;
  const { logout } = await import('./login.ts');
  return logout({ profile: strFlag(parsed.values.profile) });
}

async function profilesCmd(args: string[]): Promise<number> {
  const parsed = parse(args, {}, { positionals: true });
  if (!parsed) return 1;
  const { listProfiles, useProfile } = await import('./login.ts');
  const [action, label] = parsed.positionals;
  if (action === 'use') {
    if (!label) {
      console.error('usage: homestead profiles use <label>');
      return 1;
    }
    return useProfile(label);
  }
  if (action && action !== 'list') {
    console.error(`unknown profiles action ${JSON.stringify(action)} (expected "list" or "use")`);
    return 1;
  }
  return listProfiles();
}

async function initCmd(args: string[]): Promise<number> {
  const parsed = parse(
    args,
    {
      dir: { type: 'string' },
      ai: { type: 'string' },
      'ai-model': { type: 'string' },
      'ai-key-env': { type: 'string' },
      'no-ai': { type: 'boolean', default: false },
      apps: { type: 'string' },
      'no-apps': { type: 'boolean', default: false },
      encryption: { type: 'boolean' },
      'no-encryption': { type: 'boolean', default: false },
      'no-install': { type: 'boolean', default: false },
      yes: { type: 'boolean', short: 'y', default: false },
    },
    { positionals: true },
  );
  if (!parsed) return 1;
  const { values, positionals } = parsed;

  // `--yes` (or a non-interactive stdin, e.g. CI/piped) skips every prompt and
  // takes the defaults, so `init` stays scriptable.
  const assumeYes = values.yes === true;
  const interactive = Boolean(process.stdin.isTTY) && !assumeYes;

  // Target directory: positional arg or --dir, else prompt (default cwd).
  let dir = positionals[0] ?? strFlag(values.dir);
  if (!dir && interactive) {
    dir = await promptText('Project directory', '.');
  }
  dir ??= '.';

  // AI configuration (may be undefined = none).
  let ai: AiChoice | undefined;
  try {
    ai = await resolveAiChoice(values, dir, interactive);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  // Example apps to wire into homestead.config.ts (may be empty = none).
  let apps: CatalogApp[];
  try {
    apps = await resolveAppsChoice(values, interactive);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  // Encryption at rest (opt-in): whether to generate a master key on proceed.
  const encryption = await resolveEncryptionChoice(values, interactive);

  if (interactive) {
    console.log('\nAbout to scaffold:');
    console.log(`  directory  : ${resolve(dir)}`);
    console.log(
      `  AI         : ${ai ? `${ai.provider} — ${ai.model} (key from ${ai.keyEnv})` : 'none'}`,
    );
    console.log(`  apps       : ${apps.length ? apps.map((a) => a.slug).join(', ') : 'none'}`);
    console.log(`  encryption : ${encryption ? 'on (master key at ~/.homestead/master.key)' : 'off'}`);
    if (!(await promptYesNo('Proceed?', true))) {
      console.log('aborted.');
      return 1;
    }
  }

  let root: string;
  try {
    root = scaffold(dir, { ai, apps });
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
  console.log(`scaffolded Homestead project at ${root}`);

  // Generate the master key (writes ~/.homestead/master.key, which the server
  // auto-loads on boot). Skips with a note if a key is already configured.
  if (encryption) setupEncryption();

  if (values['no-install'] === true) {
    console.log('skipping dependency install (--no-install); run it before `homestead start`.');
  } else {
    // Install up front so `homestead start` is the only remaining step. A
    // failure isn't fatal — start retries the install itself.
    const { findRuntime } = await import('./runtime.ts');
    const { spawnSync } = await import('node:child_process');
    const installCmd = findRuntime(root).install();
    console.log(`installing dependencies (${installCmd.join(' ')})...`);
    const install = spawnSync(installCmd[0]!, installCmd.slice(1), {
      cwd: root,
      stdio: 'inherit',
    });
    if (install.status !== 0) {
      console.error('dependency install failed — `homestead start` will retry it.');
    }
  }

  console.log('\nNext steps:');
  console.log(`  cd ${root}`);
  if (ai) {
    console.log(`  # ensure ${ai.keyEnv} is set in your environment (or a .env file)`);
  }
  if (!encryption) {
    console.log('  # run `homestead key generate` to turn on encryption at rest');
  }
  console.log('  homestead start\n');
  console.log('Edit homestead.config.ts to pick which apps ship, or run');
  console.log('`homestead init-app <name>` — apps under ./apps/ are auto-discovered.');
  return 0;
}

/**
 * Decide whether `init` should set up encryption at rest: `--no-encryption`
 * wins, then an explicit `--encryption`, then an interactive prompt (default
 * on). Non-interactive runs stay off unless `--encryption` is passed, so we
 * never mint a must-back-up key behind a script's back.
 */
async function resolveEncryptionChoice(
  values: { encryption?: boolean; 'no-encryption'?: boolean },
  interactive: boolean,
): Promise<boolean> {
  if (values['no-encryption'] === true) return false;
  if (values.encryption === true) return true;
  if (!interactive) return false;
  return promptYesNo('Enable encryption at rest? (generates a master key you must back up)', true);
}

/**
 * Generate the master key at its default location unless one is already
 * configured. The server auto-loads `~/.homestead/master.key`, so this is all
 * it takes to turn encryption on for new writes after the next start.
 */
function setupEncryption(): void {
  const existing = resolveKeyLocation();
  if (existing.source !== 'none' && existing.value) {
    const where =
      existing.source === 'env' ? 'HOMESTEAD_MASTER_KEY' : (existing.path ?? 'the configured file');
    console.log(`\nEncryption: a master key is already configured (${where}); leaving it in place.`);
    return;
  }
  console.log('');
  generateKeyCmd({}); // writes ~/.homestead/master.key (0600) + backup guidance
}

/**
 * Decide the AI configuration for `init`, in priority order: `--no-ai` wins,
 * then an explicit `--ai=<provider>` flag, then inference from an existing
 * `.env` in the target dir. Interactive runs prompt (pre-filled with any
 * inferred choice); non-interactive runs take the inferred value or none.
 * `--ai-model` / `--ai-key-env` override the model / key env var throughout.
 */
async function resolveAiChoice(
  values: Record<string, string | boolean | undefined>,
  dir: string,
  interactive: boolean,
): Promise<AiChoice | undefined> {
  if (values['no-ai'] === true) return undefined;

  const modelOverride = strFlag(values['ai-model']);
  const keyEnvOverride = strFlag(values['ai-key-env']);

  const aiFlag = strFlag(values.ai);
  if (aiFlag) {
    if (aiFlag === 'none') return undefined;
    return aiChoiceFor(parseAiProvider(aiFlag), { model: modelOverride, keyEnv: keyEnvOverride });
  }

  const inferred = inferAiFromEnv(dir);

  if (!interactive) {
    if (!inferred) return undefined;
    return aiChoiceFor(inferred.provider, {
      model: modelOverride ?? inferred.model,
      keyEnv: keyEnvOverride ?? inferred.keyEnv,
    });
  }

  if (inferred) {
    console.log(
      `\nFound ${inferred.keyEnv} in ${resolve(dir, '.env')} — suggesting the ${inferred.provider} provider.`,
    );
  }
  const provider = await promptChoice(
    'Set up the AI assistant',
    ['none', 'anthropic', 'openai', 'google'],
    inferred?.provider ?? 'none',
  );
  if (provider === 'none') return undefined;
  const chosen = parseAiProvider(provider);
  const preset = chosen === inferred?.provider ? inferred : undefined;
  const defaults = AI_PROVIDER_DEFAULTS[chosen];
  const model = modelOverride ?? (await promptText('  Model', preset?.model ?? defaults.model));
  const keyEnv =
    keyEnvOverride ?? (await promptText('  API key env var', preset?.keyEnv ?? defaults.keyEnv));
  return aiChoiceFor(chosen, { model, keyEnv });
}

/**
 * Decide which example apps `init` wires into homestead.config.ts, in priority
 * order: `--no-apps` wins, then an explicit `--apps=<list>` flag, then an
 * interactive picker. Non-interactive runs with no flag select none. Throws (on
 * an unknown app name) so the caller can print the error and exit 1.
 */
async function resolveAppsChoice(
  values: Record<string, string | boolean | undefined>,
  interactive: boolean,
): Promise<CatalogApp[]> {
  if (values['no-apps'] === true) return [];

  const flag = strFlag(values.apps);
  if (flag !== undefined) return parseAppsFlag(flag);

  if (!interactive) return [];
  return promptApps();
}

/**
 * Parse an `--apps` value: the sentinels `all` / `none` (or empty), else a
 * comma-separated list of app slugs / export names. Throws on an unknown name.
 */
function parseAppsFlag(raw: string): CatalogApp[] {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === '' || trimmed === 'none') return [];
  if (trimmed === 'all') return [...APP_CATALOG];
  return resolveApps(raw.split(',').map((s) => s.trim()).filter(Boolean));
}

/**
 * Interactive multi-select for the example apps. Lists the catalog with an
 * index and re-asks until the answer resolves. Accepts a comma-separated mix of
 * numbers, slugs, and export names, plus the sentinels `all` / `none`.
 */
async function promptApps(): Promise<CatalogApp[]> {
  console.log('\nExample apps available to include (from @rambleraptor/homestead-apps):');
  APP_CATALOG.forEach((a, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${a.slug.padEnd(14)} ${a.description}`);
  });
  return withReadline(async (rl) => {
    for (;;) {
      const ans = (
        await rl.question('\nInclude which apps? numbers/names comma-separated, "all", or "none" [none]: ')
      ).trim();
      if (!ans || ans.toLowerCase() === 'none') return [];
      if (ans.toLowerCase() === 'all') return [...APP_CATALOG];
      // Map any 1-based index tokens to their slug before resolving; slugs and
      // export names pass through untouched.
      const tokens = ans
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((t) => {
          const n = Number(t);
          if (Number.isInteger(n) && n >= 1 && n <= APP_CATALOG.length) {
            return APP_CATALOG[n - 1]!.slug;
          }
          return t;
        });
      try {
        return resolveApps(tokens);
      } catch (err) {
        console.log(`  ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  });
}

/** Run `fn` with a short-lived readline interface bound to stdin/stdout. */
async function withReadline<T>(fn: (rl: ReadlineInterface) => Promise<T>): Promise<T> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await fn(rl);
  } finally {
    rl.close();
  }
}

/** Prompt for free text, returning `def` on an empty answer. */
async function promptText(label: string, def: string): Promise<string> {
  return withReadline(async (rl) => {
    const ans = (await rl.question(`${label} [${def}]: `)).trim();
    return ans || def;
  });
}

/** Prompt yes/no, returning `def` on an empty answer. */
async function promptYesNo(label: string, def: boolean): Promise<boolean> {
  return withReadline(async (rl) => {
    const ans = (await rl.question(`${label} [${def ? 'Y/n' : 'y/N'}]: `)).trim().toLowerCase();
    if (!ans) return def;
    return ans.startsWith('y');
  });
}

/** Prompt for one of `choices` (case-insensitive), re-asking until valid. */
async function promptChoice(label: string, choices: string[], def: string): Promise<string> {
  return withReadline(async (rl) => {
    for (;;) {
      const ans = (await rl.question(`${label} (${choices.join('/')}) [${def}]: `))
        .trim()
        .toLowerCase();
      if (!ans) return def;
      if (choices.includes(ans)) return ans;
      console.log(`  please choose one of: ${choices.join(', ')}`);
    }
  });
}

async function keyCmd(args: string[]): Promise<number> {
  const parsed = parse(
    args,
    { file: { type: 'string' }, force: { type: 'boolean', default: false } },
    { positionals: true },
  );
  if (!parsed) return 1;
  const action = parsed.positionals[0];
  const { generateKeyCmd, showKeyCmd } = await import('./key.ts');
  switch (action) {
    case 'generate':
      return generateKeyCmd({
        file: strFlag(parsed.values.file),
        force: parsed.values.force === true,
      });
    case 'show':
      return showKeyCmd({ file: strFlag(parsed.values.file) });
    default:
      console.error('usage: homestead key <generate|show> [--file=PATH] [--force]');
      return 1;
  }
}

async function backupCmd(args: string[]): Promise<number> {
  const parsed = parse(args, {
    'data-dir': { type: 'string' },
    out: { type: 'string' },
  });
  if (!parsed) return 1;
  const { backupCmd: runBackup } = await import('./backup.ts');
  return runBackup({
    dataDir: strFlag(parsed.values['data-dir']),
    out: strFlag(parsed.values.out),
    stamp: backupStamp(),
  });
}

/** Compact UTC stamp (YYYYMMDD-HHMMSS) for backup/restore filenames. */
function backupStamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
}

async function restoreCmd(args: string[]): Promise<number> {
  const parsed = parse(args, {
    from: { type: 'string' },
    'data-dir': { type: 'string' },
    verify: { type: 'boolean' },
    force: { type: 'boolean' },
    'allow-key-mismatch': { type: 'boolean' },
  });
  if (!parsed) return 1;
  const { restoreCmd: runRestore } = await import('./restore.ts');
  return runRestore({
    from: strFlag(parsed.values.from),
    dataDir: strFlag(parsed.values['data-dir']),
    verify: parsed.values.verify === true,
    force: parsed.values.force === true,
    allowKeyMismatch: parsed.values['allow-key-mismatch'] === true,
    stamp: backupStamp(),
  });
}

async function initAppCmd(args: string[]): Promise<number> {
  const parsed = parse(args, {}, { positionals: true });
  if (!parsed) return 1;
  const rawName = parsed.positionals[0];
  if (!rawName) {
    console.error('usage: homestead init-app <name>');
    return 1;
  }
  let dir: string;
  let names: ReturnType<typeof scaffoldApp>['names'];
  try {
    ({ dir, names } = scaffoldApp(rawName, '.'));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
  console.log(`scaffolded app "${names.display}" at ${dir}`);
  console.log('\nRestart `homestead start` to apply the new app and its resources.');
  return 0;
}

async function doctorCmd(args: string[]): Promise<number> {
  const parsed = parse(args, {
    port: { type: 'string' },
  });
  if (!parsed) return 1;
  const checks = await runDoctor({
    projectDir: '.',
    frontendPort: numFlag(parsed.values.port, 3000),
  });
  for (const c of checks) console.log(formatCheck(c));
  console.log();
  if (hasFailures(checks)) {
    console.log('✗ doctor found failures — fix the items above before `homestead start`');
    return 1;
  }
  console.log('✓ ready for `homestead start`');
  return 0;
}

async function installServiceCmd(args: string[]): Promise<number> {
  const parsed = parse(args, {
    'service-name': { type: 'string', default: 'homestead' },
    user: { type: 'string' },
    port: { type: 'string' },
    'data-dir': { type: 'string' },
    'env-file': { type: 'string' },
  });
  if (!parsed) return 1;
  const { installServices } = await import('./service.ts');
  return installServices({
    projectDir: '.',
    serviceName: strFlag(parsed.values['service-name']) ?? 'homestead',
    user:
      strFlag(parsed.values.user) ?? process.env.SUDO_USER ?? process.env.USER ?? 'root',
    port: numFlag(parsed.values.port, 3000),
    dataDir: strFlag(parsed.values['data-dir']),
    envFile: strFlag(parsed.values['env-file']),
  });
}

function formatCheck(c: Check): string {
  const mark = c.status === 'ok' ? '✓' : c.status === 'warn' ? '⚠' : '✗';
  return `  ${mark}  ${c.name.padEnd(16)}  ${c.detail}`;
}

function printUsage(): void {
  console.log(
    [
      'homestead — run a Homestead instance from a single binary.',
      '',
      'Usage:',
      '  homestead init [<dir>]      Scaffold a new project (prompts for dir + AI unless bypassed).',
      '  homestead init-app <name>   Scaffold a new custom app skeleton under ./apps/<name>.',
      '  homestead start [--dev]     Boot the server + SPA using homestead.config.ts in CWD.',
      '  homestead doctor            Check whether the host can run `homestead start`.',
      '  homestead install-service   (Optional) Install the systemd service (run with sudo).',
      '  homestead resources [...]   CRUD/List resources + their custom methods (run bare to list them).',
      '  homestead login             Log in to a server and save a profile (creds for `resources`).',
      '  homestead logout            Revoke + remove a saved login profile.',
      '  homestead profiles [use L]  List saved profiles, or repoint the default to profile L.',
      '  homestead admin reset-password  Rotate the superuser password (prints the new one).',
      '  homestead key generate      Create a master key for encryption-at-rest (writes ~/.homestead/master.key).',
      '  homestead key show          Print the resolved master key (for backing up to a password manager).',
      '  homestead backup            Archive the data dir (consistent db snapshot; never includes the key).',
      '  homestead restore           Rebuild a data dir from an archive, or --verify one.',
      '',
      'Flags for `init`:',
      '  --dir=PATH                  Project directory (default: prompt, or cwd with --yes).',
      '  --ai=PROVIDER               AI provider: none | anthropic | openai | google.',
      '  --ai-model=ID               Model id for the chosen provider.',
      '  --ai-key-env=NAME           Env var the config reads the API key from.',
      '  --no-ai                     Skip AI setup (overrides .env inference).',
      '  --apps=LIST                 Example apps to include: all | none | comma-separated slugs.',
      '  --no-apps                   Include no example apps (overrides the picker).',
      '  --encryption                Generate a master key so encryption at rest is on.',
      '  --no-encryption             Skip the encryption-at-rest key (overrides the prompt).',
      '  --no-install                Skip the dependency install step.',
      '  -y, --yes                   Accept defaults (incl. inferred AI); no prompts.',
      '',
      'Flags for `start`:',
      '  --dev                       Serve the SPA via Vite (HMR) instead of the cached production build.',
      '  --port=N                    User-facing port; serves the SPA and /api/aep engine (default 3000).',
      '  --data-dir=PATH             server data dir (default <project>/data).',
      '',
      'Flags for `install-service`:',
      '  --service-name=NAME         Base unit name (default homestead).',
      '  --user=NAME                 User the units run as (default $SUDO_USER).',
      '  --port=N                    App port baked into the service (default 3000).',
      '  --data-dir=PATH             server data dir (default <project>/data).',
      '  --env-file=PATH             EnvironmentFile for the units (default <project>/.env if present).',
      '',
      'Flags for `login`:',
      '  --server=URL                Server to log in to (a trailing /api/aep is ok). Prompts if omitted.',
      '  --email=EMAIL --password=PW Account credentials. Prompts (password hidden) if omitted.',
      '  --profile=LABEL             Profile label to save under (default "default").',
      '  --set-default               Make this profile the default even if one already exists.',
      '',
      'Flags for `resources`:',
      '  --profile=LABEL             Login profile to authenticate with (default: the default profile).',
      '  --server-url=URL            Engine/app URL (overrides the profile; default the profile or loopback).',
      '  --port=N                    Loopback port when no profile/--server-url is set (default 3000).',
      '  --@data=PATH                JSON file supplying a custom method/create body.',
      '  --token=TOKEN               Bearer token, overriding any stored profile.',
      '  --email=EMAIL --password=PW Log in fresh, overriding any stored profile.',
      '',
      'Flags for `key`:',
      '  --file=PATH                 Key file location (default ~/.homestead/master.key).',
      '  --force                     Overwrite an existing key (destroys access to data under the old key).',
      '',
      'Flags for `backup`:',
      '  --data-dir=PATH             Data dir to archive (default <project>/data).',
      '  --out=PATH                  Output archive path (default homestead-backup-<timestamp>.tar.gz).',
      '',
      'Flags for `restore`:',
      '  --from=PATH                 Archive to restore (required).',
      '  --data-dir=PATH             Data dir to restore into (default <project>/data).',
      '  --verify                    Check the archive end to end; restore nothing.',
      '  --force                     Replace a non-empty data dir (renamed aside, not deleted).',
      '  --allow-key-mismatch        Restore even if the archive names a different master key.',
    ].join('\n'),
  );
}

function numFlag(v: string | boolean | undefined, def: number): number {
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return def;
}

function strFlag(v: string | boolean | undefined): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

process.exit(await main(process.argv.slice(2)));
