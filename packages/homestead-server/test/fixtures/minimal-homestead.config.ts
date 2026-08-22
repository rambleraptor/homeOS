/**
 * The smallest operator config the server's app registry will accept.
 *
 * `src/app-registry.js` resolves `homestead.config.ts` at import time, and the
 * `/api/aep` gateway imports it transitively. The repo-root config would drag
 * the whole app graph (React components included) into a server-only test run,
 * so tests that need the gateway point `HOMESTEAD_CONFIG` here instead: no apps,
 * no AI, no OAuth — just enough for the registry to initialize.
 */

export default { apps: [] };
