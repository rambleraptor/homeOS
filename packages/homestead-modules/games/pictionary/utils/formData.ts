import type { PictionaryGameFormData } from '../types';

interface BuildGamePayloadOptions {
  data: PictionaryGameFormData;
  createdBy?: string;
  /**
   * When true, omitted optional string fields are serialized as `null` so a
   * merge-patch PATCH clears them. Create requests should leave this false.
   */
  clearMissing?: boolean;
}

/** JSON body for the game record (used when no file is attached). */
export function buildGameData({
  data,
  createdBy,
  clearMissing = false,
}: BuildGamePayloadOptions): Record<string, unknown> {
  const emptyValue = clearMissing ? null : undefined;
  return {
    played_at: data.played_at || new Date().toISOString(),
    location: data.location ?? emptyValue,
    winning_word: data.winning_word ?? emptyValue,
    notes: data.notes ?? emptyValue,
    ...(createdBy && { created_by: createdBy }),
  };
}

/** Multipart body for the game record when a file field is being uploaded. */
export function buildGameFormData({
  data,
  createdBy,
}: BuildGamePayloadOptions): FormData {
  const formData = new FormData();
  formData.append('played_at', data.played_at || new Date().toISOString());
  if (data.location) formData.append('location', data.location);
  if (data.winning_word) formData.append('winning_word', data.winning_word);
  if (data.notes) formData.append('notes', data.notes);
  if (createdBy) formData.append('created_by', createdBy);
  if (data.winning_word_image) {
    formData.append('winning_word_image', data.winning_word_image);
  }
  return formData;
}
