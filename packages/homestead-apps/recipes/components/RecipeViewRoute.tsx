import type { AppRouteProps } from '@rambleraptor/homestead-core/apps/types';
import { RecipeView } from './RecipeView';

export function RecipeViewRoute({ params }: AppRouteProps) {
  return <RecipeView recipeId={params?.id ?? ''} />;
}
