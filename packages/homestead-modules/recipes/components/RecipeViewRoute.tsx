import type { ModuleRouteProps } from '@rambleraptor/homestead-app/registry/types';
import { RecipeView } from './RecipeView';

export function RecipeViewRoute({ params }: ModuleRouteProps) {
  return <RecipeView recipeId={params?.id ?? ''} />;
}
