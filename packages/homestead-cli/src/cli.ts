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
  AI_PROVIDER_DEFAULTS,
  type AiChoice,
} from './scaffold.ts';
import { runDoctor, hasFailures, type Check } from './doctor.ts';

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
    case 'admin':
      return adminCmd(rest);
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

async function initCmd(args: string[]): Promise<number> {
  const parsed = parse(
    args,
    {
      dir: { type: 'string' },
      ai: { type: 'string' },
      'ai-model': { type: 'string' },
      'ai-key-env': { type: 'string' },
      'no-ai': { type: 'boolean', default: false },
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

  if (interactive) {
    console.log('\nAbout to scaffold:');
    console.log(`  directory : ${resolve(dir)}`);
    console.log(
      `  AI        : ${ai ? `${ai.provider} — ${ai.model} (key from ${ai.keyEnv})` : 'none'}`,
    );
    if (!(await promptYesNo('Proceed?', true))) {
      console.log('aborted.');
      return 1;
    }
  }

  let root: string;
  try {
    root = scaffold(dir, { ai });
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
  console.log(`scaffolded Homestead project at ${root}`);

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
  console.log('  homestead start\n');
  console.log('Edit homestead.config.ts to pick which apps ship, or run');
  console.log('`homestead init-app <name>` — apps under ./apps/ are auto-discovered.');
  return 0;
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
      '  homestead admin reset-password  Rotate the superuser password (prints the new one).',
      '',
      'Flags for `init`:',
      '  --dir=PATH                  Project directory (default: prompt, or cwd with --yes).',
      '  --ai=PROVIDER               AI provider: none | anthropic | openai | google.',
      '  --ai-model=ID               Model id for the chosen provider.',
      '  --ai-key-env=NAME           Env var the config reads the API key from.',
      '  --no-ai                     Skip AI setup (overrides .env inference).',
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
      'Flags for `resources`:',
      '  --server-url=URL            Engine base URL (default http://127.0.0.1:<port>/api/aep).',
      '  --port=N                    App port for the engine base URL when --server-url is unset (default 3000).',
      '  --@data=PATH                JSON file supplying a custom method/create body.',
      '  --token=TOKEN               Bearer token; skips the local admin-token mint.',
      '  --email=EMAIL --password=PW Superuser creds; skips the local admin-token mint.',
      '  --data-dir=PATH             Data dir holding the sqlite db (default <project>/data).',
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
