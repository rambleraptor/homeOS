/**
 * Resolve a recipe's `image` file field to a blob URL the browser can render.
 *
 * Browsers can't auth a plain `<img src>` at aepbase's `:download` POST
 * endpoint, so we fetch the bytes here, blob-URL them, and revoke the URL on
 * unmount / when the input changes. Mirrors gift-cards' `useGiftCardImageUrl`.
 */

import { useEffect, useState } from 'react';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { logger } from '@rambleraptor/homestead-core/utils/logger';
import { RECIPES } from '../resources';
import type { Recipe } from '../types';

export function useRecipeImageUrl(
  recipe: Recipe | null | undefined,
): string | null {
  const recipeId = recipe?.id;
  const filename = recipe?.image;

  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!recipeId || !filename) return;
    let cancelled = false;
    let createdUrl: string | null = null;

    aepbase
      .download(RECIPES, recipeId, 'image')
      .then((blob) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setUrl(createdUrl);
      })
      .catch((error) => {
        if (cancelled) return;
        logger.error('Failed to download recipe image', error, { recipeId });
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [recipeId, filename]);

  return recipeId && filename ? url : null;
}
