/**
 * @rambleraptor/homestead-apps
 *
 * Aggregate barrel of every feature app that ships in this package.
 * Settings, superuser, the registry itself, and the app-contract types
 * remain in the app shell (see `packages/homestead-app/src/apps/`) — they are part
 * of the core experience, not feature content.
 */

export { creditCardsApp } from './credit-cards';
export { dashboardApp } from './dashboard';
export { eventsApp } from './events';
export { gamesApp } from './games';
export { giftCardsApp } from './gift-cards';
export { groceriesApp } from './groceries';
export { hsaApp } from './hsa';
export { notificationsApp } from './notifications';
export { peopleApp } from './people';
export { recipesApp } from './recipes';
export { todosApp } from './todos';
