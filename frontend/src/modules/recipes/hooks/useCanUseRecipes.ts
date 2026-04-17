'use client';

/**
 * Returns whether the current user should see the Recipes module.
 *
 * Backed by the household-wide `recipes.visibility` flag:
 *   - 'all'       → everyone signed in
 *   - 'superuser' → only superusers
 *   - 'none'      → nobody (superusers do NOT bypass this)
 *
 * This deliberately differs from `useCanUseOmnibox` — the user asked
 * for a real kill switch, not a superuser-bypassable gate.
 */

import { useAuth } from '@/core/auth/useAuth';
import { useModuleFlag } from '@/modules/settings/hooks/useModuleFlag';
import type { RecipesVisibility } from '../module.config';

export function useCanUseRecipes(): boolean {
  const { user } = useAuth();
  const { value } = useModuleFlag<RecipesVisibility>('recipes', 'visibility');
  const v: RecipesVisibility = value ?? 'superuser';
  if (v === 'none') return false;
  if (!user) return false;
  if (v === 'all') return true;
  return user.type === 'superuser';
}
