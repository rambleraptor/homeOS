/**
 * Recipes bulk import — the standardized page.
 *
 * Replaces the old `RecipeImportModal`: import now has its own route, like
 * every other app's, and the format list (plain text, Paprika) comes from the
 * server's `bulkImport` declaration on the recipe resource rather than a
 * client-side importer registry.
 */

import { BulkImportContainer } from '@rambleraptor/homestead-core/shared/bulk-import';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { RECIPES } from '../resources';
import { RecipePreview } from './RecipePreview';

export function RecipesBulkImport() {
  return (
    <BulkImportContainer
      config={{
        plural: RECIPES,
        appName: 'Recipes',
        appNamePlural: 'recipes',
        backRoute: '/recipes',
        queryKey: queryKeys.app('recipes').all(),
        preview: RecipePreview,
      }}
    />
  );
}
