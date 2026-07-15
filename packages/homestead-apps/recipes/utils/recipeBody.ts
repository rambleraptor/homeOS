import type { RecipeFormData } from '../types';

/**
 * Serialize a recipe for an aepbase create/update call.
 *
 * When a photo `File` is present we must POST/PATCH multipart form-data so
 * aepbase's file-field handler picks up the bytes; array/object fields are
 * JSON-encoded per part (the engine JSON-parses object/array parts back).
 * Without a photo we send a plain JSON body — the simple path for manual and
 * image-less imports. `image: null | undefined` means "no photo change": it is
 * dropped so a PATCH merge leaves any existing photo untouched.
 */
export function buildRecipeBody(
  data: RecipeFormData,
  createdBy?: string,
): Record<string, unknown> | FormData {
  const { image, ...rest } = data;

  if (!image) {
    return { ...rest, ...(createdBy ? { created_by: createdBy } : {}) };
  }

  const formData = new FormData();
  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined || value === null) continue;
    formData.append(
      key,
      typeof value === 'string' ? value : JSON.stringify(value),
    );
  }
  if (createdBy) formData.append('created_by', createdBy);
  formData.append('image', image);
  return formData;
}
