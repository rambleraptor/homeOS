// Minimal structural view of homestead.config.ts for the CLI. The CLI only
// reads `auth.oauth` to serialize it across the process boundary into the
// aepbase child's AEPBASE_OAUTH env var, so it deliberately does NOT import the
// authoritative `HomesteadConfig` type from @rambleraptor/homestead-core —
// doing so would drag the app's (DOM/JSX) source into the CLI's tsc program.
//
// Source-of-truth for the OAuth shape: HomesteadConfig.auth.oauth in
// packages/homestead-core/apps/config.ts (TS side) and the AEPBASE_OAUTH
// struct in aepbase/oauth.go (the actual wire contract).

export interface CliOAuthConfig {
  redirectBaseUrl: string;
  successRedirect: string;
  providers: unknown[];
}

export interface CliGitConfig {
  /** Remote to track. Default `origin`. */
  remote?: string;
  /** Branch to track. Default `main`. */
  branch?: string;
}

export interface CliConfig {
  apps: unknown[];
  auth?: { oauth?: CliOAuthConfig };
  git?: CliGitConfig;
}
