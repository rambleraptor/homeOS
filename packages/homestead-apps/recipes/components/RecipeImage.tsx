/**
 * Renders a recipe's photo. Returns null while the aepbase blob is loading,
 * on download failure, or when the recipe has no image.
 */

import type { Recipe } from '../types';
import { useRecipeImageUrl } from '../hooks/useRecipeImageUrl';

interface RecipeImageProps {
  recipe: Recipe;
  alt: string;
  className?: string;
}

export function RecipeImage({ recipe, alt, className }: RecipeImageProps) {
  const url = useRecipeImageUrl(recipe);
  if (!url) return null;
  return <img src={url} alt={alt} className={className} />;
}
