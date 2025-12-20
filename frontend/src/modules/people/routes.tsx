import type { RouteObject } from 'react-router-dom';
import { PeopleHome } from './components/PeopleHome';
import { PeopleBulkImport } from './bulk-import';

export const peopleRoutes: RouteObject[] = [
  {
    index: true,
    element: <PeopleHome />,
  },
  {
    path: 'import',
    element: <PeopleBulkImport />,
  },
];
