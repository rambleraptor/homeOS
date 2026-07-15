import { describe, it, expect } from 'vitest';
import { buildRecipeBody } from '../utils/recipeBody';
import type { RecipeFormData } from '../types';

const BASE: RecipeFormData = {
  title: 'Bacon Wrapped Asparagus',
  parsed_ingredients: [
    { item: 'asparagus', qty: 1, unit: 'pound', raw: '1 pound asparagus' },
  ],
  steps: ['Preheat oven', 'Bake'],
  tags: ['Sides'],
};

describe('buildRecipeBody', () => {
  it('returns a plain object when there is no photo', () => {
    const body = buildRecipeBody(BASE, 'users/u1');
    expect(body).not.toBeInstanceOf(FormData);
    expect(body).toMatchObject({
      title: 'Bacon Wrapped Asparagus',
      parsed_ingredients: BASE.parsed_ingredients,
      steps: BASE.steps,
      tags: BASE.tags,
      created_by: 'users/u1',
    });
    expect('image' in (body as Record<string, unknown>)).toBe(false);
  });

  it('omits created_by when none is supplied', () => {
    const body = buildRecipeBody(BASE) as Record<string, unknown>;
    expect('created_by' in body).toBe(false);
  });

  it('drops a null/undefined image (no photo change)', () => {
    expect(buildRecipeBody({ ...BASE, image: null })).not.toBeInstanceOf(
      FormData,
    );
    expect(buildRecipeBody({ ...BASE, image: undefined })).not.toBeInstanceOf(
      FormData,
    );
  });

  it('builds multipart form-data with JSON-encoded array parts and the file', () => {
    const image = new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' });
    const body = buildRecipeBody({ ...BASE, image }, 'users/u1');
    expect(body).toBeInstanceOf(FormData);
    const form = body as FormData;
    expect(form.get('title')).toBe('Bacon Wrapped Asparagus');
    // Array/object fields are JSON-encoded strings; the engine parses them back.
    expect(form.get('steps')).toBe(JSON.stringify(BASE.steps));
    expect(form.get('parsed_ingredients')).toBe(
      JSON.stringify(BASE.parsed_ingredients),
    );
    expect(form.get('created_by')).toBe('users/u1');
    const uploaded = form.get('image');
    expect(uploaded).toBeInstanceOf(File);
    expect((uploaded as File).name).toBe('photo.jpg');
  });
});
