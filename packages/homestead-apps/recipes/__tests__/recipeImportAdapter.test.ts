import { describe, expect, it } from 'vitest';
import { toParsedItems } from '../methods/recipe-import-adapter';
import type { RecipeImportResult } from '../importers/types';
import type { RecipeFormData } from '../types';

const recipe = (title: string): RecipeFormData => ({
  title,
  parsed_ingredients: [],
});

const ok = (...titles: string[]): RecipeImportResult => ({
  data: recipe(titles[0]),
  additional: titles.slice(1).map(recipe),
  warnings: [],
  errors: [],
});

describe('toParsedItems', () => {
  it('flattens data + additional into one item per recipe', () => {
    const items = toParsedItems([ok('Soup', 'Salad', 'Bread')]);
    expect(items.map((i) => i.label)).toEqual(['Soup', 'Salad', 'Bread']);
    expect(items.map((i) => i.index)).toEqual([0, 1, 2]);
    expect(items.every((i) => i.errors.length === 0)).toBe(true);
  });

  it('numbers items continuously across files', () => {
    const items = toParsedItems([ok('Soup'), ok('Salad', 'Bread')], ['a.zip', 'b.zip']);
    expect(items.map((i) => i.index)).toEqual([0, 1, 2]);
  });

  it('turns a file that produced no recipes into one errored item', () => {
    // The old modal had to demote per-file fatal errors to warnings so good
    // files still imported; per-item errors isolate the bad file for free.
    const items = toParsedItems(
      [{ warnings: [], errors: ['Unrecognized file format'] }, ok('Soup')],
      ['broken.zip', 'good.zip'],
    );
    expect(items).toHaveLength(2);
    expect(items[0].errors).toEqual(['broken.zip: Unrecognized file format']);
    expect(items[1].errors).toEqual([]);
    expect(items[1].label).toBe('good.zip: Soup');
  });

  it('reports a result with no recipes and no errors as an error', () => {
    const items = toParsedItems([{ warnings: [], errors: [] }]);
    expect(items[0].errors).toEqual(['No recipes found']);
  });

  it('prefixes labels and warnings with the filename only when multiple files', () => {
    const single = toParsedItems([{ ...ok('Soup'), warnings: ['odd units'] }], ['a.zip']);
    expect(single[0].label).toBe('Soup');
    expect(single[0].warnings).toEqual(['odd units']);

    const multi = toParsedItems(
      [{ ...ok('Soup'), warnings: ['odd units'] }, ok('Salad')],
      ['a.zip', 'b.zip'],
    );
    expect(multi[0].label).toBe('a.zip: Soup');
    expect(multi[0].warnings).toEqual(['a.zip: odd units']);
  });

  it('drops the image field, which the engine takes only as a multipart upload', () => {
    const items = toParsedItems([
      { data: { ...recipe('Soup'), image: null }, warnings: [], errors: [] },
    ]);
    expect(items[0].data).not.toHaveProperty('image');
  });
});
