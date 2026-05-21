import type { ModuleRouteProps } from '@rambleraptor/homestead-core/modules/types';
import { RecipeView } from './RecipeView';

export function RecipeViewRoute({ params }: ModuleRouteProps) {
  return <RecipeView recipeId={params?.id ?? ''} />;
}
