/**
 * Gift Cards Module Configuration
 *
 * Module for managing household gift cards
 */

import type { HomeModule } from '../types';
import { Gift } from 'lucide-react';
import { giftCardRoutes } from './routes';

export const giftCardsModule: HomeModule = {
  id: 'gift-cards',
  name: 'Gift Cards',
  description: 'Manage and track household gift cards',
  icon: Gift,
  basePath: '/gift-cards',
  routes: giftCardRoutes,
  showInNav: true,
  navOrder: 2,
  enabled: true,
};
