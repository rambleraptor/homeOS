/**
 * Recipe Importer Types
 *
 * A recipe importer converts a string input in a particular format into a
 * `RecipeFormData` suitable for `useCreateRecipe`. New formats (JSON-LD,
 * schema.org markup, URL fetch, CSV, etc.) plug in by implementing this
 * interface and registering themselves in `./index.ts`.
 */

import type { RecipeFormData } from '../types';

export interface RecipeImportResult {
  /** Parsed recipe, ready to submit. Undefined when parsing failed. */
  data?: RecipeFormData;
  /** Non-fatal warnings surfaced to the user in the preview. */
  warnings: string[];
  /** Fatal errors; when non-empty, `data` should be undefined. */
  errors: string[];
}

export interface RecipeImporter {
  /** Stable identifier used in UI state and tests. */
  id: string;
  /** Human-readable label shown in the format picker. */
  label: string;
  /** Optional help text shown above the input box. */
  description?: string;
  /** Placeholder shown in the input box. */
  placeholder?: string;
  /** Convert raw input into a recipe. Must be pure / synchronous. */
  parse(input: string): RecipeImportResult;
}
