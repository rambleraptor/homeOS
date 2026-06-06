import type { CliConfig } from './config-types.ts';
import { serializeOAuth } from './oauth.ts';
// Via a JS indirection (load-config.js + .d.ts) so `tsc` sees the config as an
// opaque CliConfig instead of following it into the whole module graph;
// `bun build --compile` still bundles the real config. `auth.oauth` secrets are
// read from process.env at runtime, not baked in.
import rootConfig from './load-config.js';

export const homesteadConfig: CliConfig = rootConfig;

/** AEPBASE_OAUTH value for the loaded config, or undefined when OAuth is off. */
export function aepbaseOAuthEnv(): string | undefined {
  return serializeOAuth(homesteadConfig);
}

/** The git remote + branch `homestead update` tracks, with defaults applied. */
export interface ResolvedGitConfig {
  remote: string;
  branch: string;
}

/** Resolve the `git` block of the loaded config, filling in defaults. */
export function gitConfig(): ResolvedGitConfig {
  const git = homesteadConfig.git ?? {};
  return {
    remote: git.remote ?? 'origin',
    branch: git.branch ?? 'main',
  };
}
