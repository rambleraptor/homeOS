/**
 * Settings App Configuration
 *
 * App for managing user preferences and notification settings.
 * Enables web push notifications and customization options.
 */

import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';

export const settingsApp: AppConfig = {
  id: 'settings',
  name: 'Settings',
  description: 'Manage your preferences and notifications',
  flags: {
    // Which tool surface the built-in MCP server at /api/mcp serves. Lives
    // here rather than in homestead.config.ts so an operator can flip it from
    // Flag Management without a restart — MCP clients pick the new surface up
    // on their next tools/list.
    mcp_tools: {
      type: 'enum',
      label: 'MCP tool surface',
      description:
        'How /api/mcp exposes your data. "typed" gives an MCP client four tools per ' +
        'resource plus one per custom method (richest schemas, but ~167 tools). ' +
        '"generic" collapses that to six tools that take the resource as a parameter, ' +
        'for clients that hit a tool cap or whose context you want back.',
      options: ['typed', 'generic'],
      default: 'typed',
    },
  },
  web: {
    icon: () => import('lucide-react').then((m) => m.Settings),
    basePath: '/settings',
    routes: [
      {
        path: '',
        index: true,
        component: () => import('./components/SettingsHome').then((m) => m.SettingsHome),
      },
    ],
    section: 'Settings',
    showInNav: true,
    navOrder: 100,
  },
};
