# Module Development Guide

This guide will walk you through creating a new module for Homestead from scratch.

## Table of Contents

1. [Understanding Modules](#understanding-modules)
2. [Module Structure](#module-structure)
3. [Step-by-Step Tutorial](#step-by-step-tutorial)
4. [Best Practices](#best-practices)
5. [Advanced Patterns](#advanced-patterns)

---

## Understanding Modules

A **module** in Homestead is a self-contained feature with:

- **Own UI components** - No dependencies on other modules
- **Own routes** - Integrated into the main router automatically
- **Own data hooks** - Using React Query for data fetching
- **Own types** - TypeScript definitions for module-specific data
- **Permission-aware** - Respects user roles and RBAC

### Module Interface

Every module must implement the `HomeModule` interface:

```typescript
interface HomeModule {
  id: string;              // Unique identifier (lowercase, no spaces)
  name: string;            // Display name
  description: string;     // Short description
  icon: LucideIcon;       // Icon from lucide-react
  requiredRole: UserRole; // Minimum role required
  basePath: string;        // Base URL path (starts with /)
  routes: RouteObject[];  // React Router routes
  showInNav?: boolean;    // Show in sidebar (default: true)
  navOrder?: number;      // Navigation order (default: 100)
  enabled?: boolean;      // Module enabled (default: true)
}
```

---

## Module Structure

Standard module directory layout:

```
src/modules/my-module/
├── index.ts                 # Module exports
├── module.config.ts         # Module configuration (required)
├── routes.tsx               # Route definitions
├── types.ts                 # TypeScript types
├── components/
│   ├── MyModuleHome.tsx     # Main component
│   ├── MyWidget.tsx         # Sub-components
│   └── ...
└── hooks/
    ├── useMyModuleData.ts   # Data fetching hooks
    └── ...
```

---

## Step-by-Step Tutorial: Creating a "Chores" Module

Let's build a complete Chores module from scratch.

### Step 1: Create Module Directory

```bash
cd frontend/src/modules
mkdir -p chores/{components,hooks}
```

### Step 2: Define Types

Create `chores/types.ts`:

```typescript
/**
 * Chores Module Types
 */

export interface Chore {
  id: string;
  title: string;
  description: string;
  assignedTo: string; // User ID
  dueDate: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  created: string;
  updated: string;
}

export interface ChoreFormData {
  title: string;
  description: string;
  assignedTo: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
}
```

### Step 3: Create Main Component

Create `chores/components/ChoresHome.tsx`:

```typescript
import React from 'react';
import { useAuth } from '../../../core/auth/useAuth';
import { usePermissions } from '../../../core/permissions/usePermissions';
import { Plus } from 'lucide-react';

export function ChoresHome() {
  const { user } = useAuth();
  const { canAccessModule } = usePermissions();

  const canCreate = canAccessModule('chores', 'write');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Chores
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage household tasks and assignments
          </p>
        </div>

        {canCreate && (
          <button
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            New Chore
          </button>
        )}
      </div>

      {/* Chore List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <p className="text-gray-500">No chores yet. Create your first one!</p>
      </div>
    </div>
  );
}
```

### Step 4: Create Data Hook (Optional)

Create `chores/hooks/useChores.ts`:

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import { getCollection } from '../../../core/api/pocketbase';
import { queryClient, queryKeys } from '../../../core/api/queryClient';
import { Chore, ChoreFormData } from '../types';

const COLLECTION = 'chores';

/**
 * Hook to fetch all chores
 */
export function useChores() {
  return useQuery({
    queryKey: queryKeys.module('chores').list(),
    queryFn: async () => {
      const chores = await getCollection<Chore>(COLLECTION).getFullList({
        sort: '-created',
      });
      return chores;
    },
  });
}

/**
 * Hook to create a new chore
 */
export function useCreateChore() {
  return useMutation({
    mutationFn: async (data: ChoreFormData) => {
      return await getCollection<Chore>(COLLECTION).create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.module('chores').list(),
      });
    },
  });
}

/**
 * Hook to mark chore as complete
 */
export function useCompleteChore() {
  return useMutation({
    mutationFn: async (choreId: string) => {
      return await getCollection<Chore>(COLLECTION).update(choreId, {
        completed: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.module('chores').list(),
      });
    },
  });
}
```

### Step 5: Define Routes

Create `chores/routes.tsx`:

```typescript
import { RouteObject } from 'react-router-dom';
import { ChoresHome } from './components/ChoresHome';
// Import other views as needed
// import { ChoreDetail } from './components/ChoreDetail';

export const choresRoutes: RouteObject[] = [
  {
    index: true,
    element: <ChoresHome />,
  },
  // Add child routes if needed
  // {
  //   path: ':choreId',
  //   element: <ChoreDetail />,
  // },
];
```

### Step 6: Create Module Configuration

Create `chores/module.config.ts`:

```typescript
import { HomeModule } from '../types';
import { ListTodo } from 'lucide-react';
import { choresRoutes } from './routes';

export const choresModule: HomeModule = {
  id: 'chores',
  name: 'Chores',
  description: 'Manage household chores and tasks',
  icon: ListTodo,
  requiredRole: 'member', // Members and admins can access
  basePath: '/chores',
  routes: choresRoutes,
  showInNav: true,
  navOrder: 10,
  enabled: true,
};
```

### Step 7: Create Index File

Create `chores/index.ts`:

```typescript
/**
 * Chores Module Entry Point
 */

export * from './module.config';
export * from './types';
export * from './components/ChoresHome';
```

### Step 8: Register the Module

Edit `src/modules/registry.ts`:

```typescript
// Add import
import { choresModule } from './chores/module.config';

// Add to MODULES array
const MODULES: HomeModule[] = [
  dashboardModule,
  choresModule, // ← Add here
  // ... other modules
];
```

### Step 9: Create PocketBase Collection

In PocketBase Admin UI (`http://127.0.0.1:8090/_/`):

1. Go to **Collections** → **New Collection**
2. Name: `chores`
3. Type: **Base**
4. Add fields:
   - `title` (text, required)
   - `description` (text)
   - `assignedTo` (relation to users)
   - `dueDate` (date)
   - `completed` (bool, default: false)
   - `priority` (select: low, medium, high)

5. Set API Rules:
   ```javascript
   // List/Search: Authenticated users
   @request.auth.id != ""

   // View: Authenticated users
   @request.auth.id != ""

   // Create: Members and admins
   @request.auth.role = "member" || @request.auth.role = "admin"

   // Update: Owner or admin
   assignedTo = @request.auth.id || @request.auth.role = "admin"

   // Delete: Admins only
   @request.auth.role = "admin"
   ```

### Step 10: Test Your Module!

1. Refresh the app
2. You should see "Chores" in the sidebar
3. Click it to navigate to `/chores`
4. Your ChoresHome component should render

**Congratulations! 🎉** You've created your first Homestead module!

---

## Best Practices

### 1. Self-Contained Modules

✅ **DO:**
```typescript
// Use module-specific hooks
import { useChores } from '../hooks/useChores';
```

❌ **DON'T:**
```typescript
// Don't import from other modules
import { useMeals } from '../../meals/hooks/useMeals';
```

### 2. Type Safety

✅ **DO:**
```typescript
// Define types for all data
interface Chore {
  id: string;
  title: string;
  // ...
}
```

❌ **DON'T:**
```typescript
// Avoid using 'any'
const data: any = await fetchData();
```

### 3. Permission Checks

✅ **DO:**
```typescript
const { canAccessModule } = usePermissions();

if (!canAccessModule('chores', 'write')) {
  return <ReadOnlyView />;
}
```

❌ **DON'T:**
```typescript
// Don't hardcode permission checks
if (user.role !== 'admin') {
  // ...
}
```

### 4. Consistent Naming

- Module IDs: `lowercase_underscore`
- Components: `PascalCase`
- Hooks: `useCamelCase`
- Files: `camelCase.tsx` or `PascalCase.tsx` for components

### 5. Query Keys

Use the centralized query key factory:

```typescript
import { queryKeys } from '@/core/api/queryClient';

queryKey: queryKeys.module('chores').list()
```

---

## Advanced Patterns

### Module with Sub-Routes

```typescript
// routes.tsx
export const choresRoutes: RouteObject[] = [
  {
    index: true,
    element: <ChoresHome />,
  },
  {
    path: 'new',
    element: <ChoreCreate />,
  },
  {
    path: ':choreId',
    element: <ChoreDetail />,
  },
  {
    path: ':choreId/edit',
    element: <ChoreEdit />,
  },
];
```

### Module with Settings

```typescript
// components/ChoreSettings.tsx
export function ChoreSettings() {
  return (
    <PermissionGuard requiredRole="admin">
      <div>Admin-only chore settings...</div>
    </PermissionGuard>
  );
}
```

### Module with Realtime Updates

```typescript
import { subscribeToCollection } from '@/core/api/pocketbase';

useEffect(() => {
  const unsubscribe = subscribeToCollection<Chore>('chores', (data) => {
    if (data.action === 'create' || data.action === 'update') {
      queryClient.invalidateQueries({
        queryKey: queryKeys.module('chores').list(),
      });
    }
  });

  return () => {
    unsubscribe.then((unsub) => unsub());
  };
}, []);
```

### Module with Custom Permissions

```typescript
// module.config.ts
export const adminModule: HomeModule = {
  id: 'admin',
  name: 'Admin Panel',
  requiredRole: 'admin', // Only admins can see this
  // ...
};
```

---

## Troubleshooting

### Module Not Appearing in Navigation

1. Check that it's registered in `registry.ts`
2. Verify `showInNav` is not set to `false`
3. Confirm user has sufficient role (`requiredRole`)
4. Check browser console for errors

### Routes Not Working

1. Ensure `basePath` starts with `/`
2. Verify routes are exported correctly
3. Check for route conflicts with other modules

### Permission Errors

1. Verify PocketBase API rules match your frontend logic
2. Check user role in PocketBase Admin UI
3. Use React Query Devtools to inspect auth state

---

## Example Modules

Check these example modules for reference:

- **Dashboard** (`src/modules/dashboard/`) - Basic module with stats
- More examples coming soon!

---

## Need Help?

- Review existing modules in `src/modules/`
- Check the [Architecture docs](../PROJECT_STRUCTURE.md)
- Open an issue on GitHub

Happy coding! 🚀
