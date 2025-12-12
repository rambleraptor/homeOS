/**
 * Gift Cards Module Routes
 */

import type { RouteObject } from 'react-router-dom';
import { GiftCardHome } from './components/GiftCardHome';

export const giftCardRoutes: RouteObject[] = [
  {
    index: true,
    element: <GiftCardHome />,
  },
];
