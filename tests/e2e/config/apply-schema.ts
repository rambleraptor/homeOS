/**
 * Apply the aepbase schema for e2e tests.
 *
 * Reuses the runtime runner — `syncResourceDefinitions` from
 * `@rambleraptor/homestead-core/resources` — over the same
 * module-declared definitions the Next.js server applies on boot.
 * One source of truth, no drift.
 *
 * Module configs import React/Lucide and aren't safe to load from a
 * Node-only Playwright setup, so we import each module's pure
 * `resources.ts` directly. Adding a new module's resources here is
 * the only thing that has to be remembered alongside the module
 * declaration.
 */

import { BUILTIN_RESOURCE_DEFS } from '@rambleraptor/homestead-core/resources/builtins';
import { syncResourceDefinitions } from '@rambleraptor/homestead-core/resources/sync';
import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';
import { creditCardsResources } from '@rambleraptor/homestead-modules/credit-cards/resources';
import { giftCardsResources } from '@rambleraptor/homestead-modules/gift-cards/resources';
import { groceriesResources } from '@rambleraptor/homestead-modules/groceries/resources';
import { hsaResources } from '@rambleraptor/homestead-modules/hsa/resources';
import { notificationsResources } from '@rambleraptor/homestead-modules/notifications/resources';
import { peopleResources } from '@rambleraptor/homestead-modules/people/resources';
import { recipesResources } from '@rambleraptor/homestead-modules/recipes/resources';
import { todosResources } from '@rambleraptor/homestead-modules/todos/resources';
import { minigolfResources } from '@rambleraptor/homestead-modules/games/minigolf/resources';
import { pictionaryResources } from '@rambleraptor/homestead-modules/games/pictionary/resources';
import { getAepbaseUrl } from './aepbase.setup';

const MODULE_RESOURCES: ResourceDefinition[] = [
  ...creditCardsResources,
  ...giftCardsResources,
  ...groceriesResources,
  ...hsaResources,
  ...notificationsResources,
  ...peopleResources,
  ...recipesResources,
  ...todosResources,
  ...minigolfResources,
  ...pictionaryResources,
];

/**
 * The runtime `module-flag` schema is built dynamically from declared
 * flags by `syncModuleFlagsSchema` on Next.js boot. The Playwright dev
 * server isn't given admin creds (and even if it were, it boots before
 * aepbase is up), so that hook is skipped here — we hardcode the
 * fields the e2e tests need. Description strings must match the
 * canonical flag declarations exactly because the flag-management
 * spec asserts on the rendered text.
 */
const E2E_MODULE_FLAG_DEFINITION: ResourceDefinition = {
  singular: 'module-flag',
  plural: 'module-flags',
  description:
    'Household-wide singleton that stores current values for every declared module flag. Hardcoded here for e2e; the runtime sync builds this dynamically.',
  user_settable_create: true,
  schema: {
    type: 'object',
    properties: {
      recipes__enabled: {
        type: 'string',
        description:
          "Who can use the Recipes module. 'superusers' restricts it to superusers; 'all' makes it available to every signed-in user; 'none' hides it from everyone (including superusers). (default: superusers) (one of: superusers, all, none)",
      },
      settings__omnibox_access: {
        type: 'string',
        description:
          'Who can use the natural-language omnibox (⌘K / search bar). (default: superuser) (one of: superuser, all)',
      },
    },
  },
};

export async function applySchema(adminToken: string): Promise<void> {
  await syncResourceDefinitions({
    aepbaseUrl: getAepbaseUrl(),
    token: adminToken,
    defs: [
      ...BUILTIN_RESOURCE_DEFS,
      ...MODULE_RESOURCES,
      E2E_MODULE_FLAG_DEFINITION,
    ],
  });
}
