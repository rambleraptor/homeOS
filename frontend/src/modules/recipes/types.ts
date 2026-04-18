/**
 * Recipes Module Types
 */

export interface RecipeIngredient {
  item: string;
  qty: number;
  unit: string;
  raw: string;
}

/** Origin category for a recipe's `source_pointer`. */
export type RecipeSourceType = 'manual' | 'text' | 'url' | 'book';

/**
 * Recipe record from aepbase.
 *
 * Matches the schema in aepbase/terraform/recipes.tf. `created_by` holds
 * the aepbase resource path of the author (`users/{id}`).
 */
export interface Recipe {
  id: string;
  path: string;
  title: string;
  source_type: RecipeSourceType;
  source_pointer?: string;
  version: number;
  parsed_ingredients: RecipeIngredient[];
  method?: string;
  tags?: string[];
  created_by?: string;
  create_time: string;
  update_time: string;
}

/**
 * Form data for creating/updating recipes.
 *
 * `source_type` and `version` are optional at the form layer — the create
 * hook fills in sensible defaults (`manual` / `1`) so callers that don't
 * care about them (e.g. the manual form) don't have to.
 */
export interface RecipeFormData {
  title: string;
  source_type?: RecipeSourceType;
  source_pointer?: string;
  version?: number;
  parsed_ingredients: RecipeIngredient[];
  method?: string;
  tags?: string[];
}
