/**
 * Chat App Configuration
 *
 * Core app (always installed): a Gemini-backed household assistant
 * with one tool per CRUD operation per registered aepbase resource.
 * The backend lives in `core/server/chat/` behind the sidecar's
 * `POST /api/chat`; conversations are ephemeral (client state only).
 */

import type { HomeApp } from '../apps/types';

export const chatApp: HomeApp = {
  id: 'chat',
  name: 'Chat',
  description: 'Ask the household assistant to look up or change your data',
  icon: () => import('lucide-react').then((m) => m.MessageCircle),
  basePath: '/chat',
  routes: [
    {
      path: '',
      index: true,
      component: () => import('./components/ChatHome').then((m) => m.ChatHome),
    },
  ],
  placement: 'topbar',
  navOrder: 5,
  enabled: true,
};
