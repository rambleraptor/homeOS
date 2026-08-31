import type { VaccinationFormData } from '../types';

interface BuildOptions {
  /** `users/{id}` path stamped on create. */
  createdBy?: string;
  /**
   * `create` drops empty optional fields; `update` sends them as `null` so
   * the merge-patch clears the stored value (e.g. removing a due date or a
   * document link).
   */
  mode?: 'create' | 'update';
}

/**
 * Serialize a vaccination for an aepbase create/update call.
 *
 * When a record image `File` is present we must POST/PATCH multipart
 * form-data so aepbase's file-field handler picks up the bytes. Without one
 * we send a plain JSON body. `record_image: null | undefined` means "no
 * photo change": it is dropped so a PATCH merge leaves any existing image
 * untouched.
 */
export function buildVaccinationBody(
  data: VaccinationFormData,
  { createdBy, mode = 'create' }: BuildOptions = {},
): Record<string, unknown> | FormData {
  const { record_image, ...rest } = data;

  const fields: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined || value === null || value === '') {
      if (mode === 'update' && value !== undefined) fields[key] = null;
      continue;
    }
    fields[key] = String(value);
  }
  if (createdBy) fields.created_by = createdBy;

  if (!record_image) return fields;

  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    // Multipart has no null; an empty part clears the column the same way.
    formData.append(key, value ?? '');
  }
  formData.append('record_image', record_image);
  return formData;
}
