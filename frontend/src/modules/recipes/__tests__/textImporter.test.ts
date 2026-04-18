import { describe, it, expect } from 'vitest';
import {
  textImporter,
  parseQuantity,
  parseIngredientLine,
} from '../importers/textImporter';

describe('parseQuantity', () => {
  it('reads an integer quantity', () => {
    expect(parseQuantity('8 strips bacon')).toEqual({
      qty: 8,
      rest: 'strips bacon',
    });
  });

  it('reads a decimal quantity', () => {
    expect(parseQuantity('1.5 cups flour')).toEqual({
      qty: 1.5,
      rest: 'cups flour',
    });
  });

  it('reads a simple fraction', () => {
    expect(parseQuantity('1/2 teaspoon black pepper')).toEqual({
      qty: 0.5,
      rest: 'teaspoon black pepper',
    });
  });

  it('reads a mixed number', () => {
    expect(parseQuantity('1 1/2 cups sugar')).toEqual({
      qty: 1.5,
      rest: 'cups sugar',
    });
  });

  it('reads a unicode fraction', () => {
    expect(parseQuantity('\u00BD cup milk')).toEqual({
      qty: 0.5,
      rest: 'cup milk',
    });
  });

  it('picks the low end of a hyphenated range', () => {
    const { qty, rest } = parseQuantity('1-2 cups rice');
    expect(qty).toBe(1);
    expect(rest).toBe('cups rice');
  });

  it('defaults to qty=1 with the full line preserved when no number is present', () => {
    expect(parseQuantity('pinch of salt')).toEqual({
      qty: 1,
      rest: 'pinch of salt',
    });
  });
});

describe('parseIngredientLine', () => {
  it('splits quantity, unit, and item', () => {
    expect(parseIngredientLine('1 pound asparagus spears trimmed')).toEqual({
      qty: 1,
      unit: 'pound',
      item: 'asparagus spears trimmed',
      raw: '1 pound asparagus spears trimmed',
    });
  });

  it('handles fractional quantities', () => {
    expect(parseIngredientLine('1/2 teaspoon black pepper')).toEqual({
      qty: 0.5,
      unit: 'teaspoon',
      item: 'black pepper',
      raw: '1/2 teaspoon black pepper',
    });
  });

  it('handles unknown units by leaving unit empty', () => {
    expect(parseIngredientLine('2 large eggs')).toEqual({
      qty: 2,
      unit: '',
      item: 'large eggs',
      raw: '2 large eggs',
    });
  });

  it('treats pluralized unit words as units', () => {
    expect(parseIngredientLine('8 strips thick-cut bacon')).toEqual({
      qty: 8,
      unit: 'strips',
      item: 'thick-cut bacon',
      raw: '8 strips thick-cut bacon',
    });
  });

  it('preserves the raw line exactly', () => {
    const raw = '1 tablespoon extra-virgin olive oil';
    expect(parseIngredientLine(raw).raw).toBe(raw);
  });
});

describe('textImporter.parse', () => {
  const SAMPLE = `Bacon Wrapped Asparagus

Prep Time: 10 mins  | Cook Time: 25 mins  | Servings: Servings: 8 bundles

Ingredients:
1 pound asparagus spears trimmed (about 20 to 24 spears)
1 tablespoon extra-virgin olive oil
1/2 teaspoon black pepper
8 strips thick-cut bacon

Directions:
Place a rack in the center of your oven and preheat the oven to 400 degrees F.
Place the asparagus in a large bowl or on the prepared baking sheet.
Bake until the bacon is crisp and the asparagus is tender.

Notes:
For storage tips, see the blog post above.
To grill the bacon OR to cook it on the stovetop, see the blog post above.

Nutrition:
CALORIES: 177kcal
CARBOHYDRATES: 3g

Source: https://www.wellplated.com/bacon-wrapped-asparagus/`;

  it('extracts the title', () => {
    const result = textImporter.parse(SAMPLE);
    expect(result.errors).toEqual([]);
    expect(result.data?.title).toBe('Bacon Wrapped Asparagus');
  });

  it('extracts the source URL', () => {
    const result = textImporter.parse(SAMPLE);
    expect(result.data?.source_pointer).toBe(
      'https://www.wellplated.com/bacon-wrapped-asparagus/',
    );
  });

  it('parses all ingredients with quantity/unit/item', () => {
    const result = textImporter.parse(SAMPLE);
    expect(result.data?.parsed_ingredients).toEqual([
      {
        qty: 1,
        unit: 'pound',
        item: 'asparagus spears trimmed (about 20 to 24 spears)',
        raw: '1 pound asparagus spears trimmed (about 20 to 24 spears)',
      },
      {
        qty: 1,
        unit: 'tablespoon',
        item: 'extra-virgin olive oil',
        raw: '1 tablespoon extra-virgin olive oil',
      },
      {
        qty: 0.5,
        unit: 'teaspoon',
        item: 'black pepper',
        raw: '1/2 teaspoon black pepper',
      },
      {
        qty: 8,
        unit: 'strips',
        item: 'thick-cut bacon',
        raw: '8 strips thick-cut bacon',
      },
    ]);
  });

  it('builds a method with directions, notes, and nutrition as markdown', () => {
    const result = textImporter.parse(SAMPLE);
    const method = result.data?.method ?? '';
    expect(method).toContain('Prep Time: 10 mins');
    expect(method).toContain('## Directions');
    expect(method).toContain('1. Place a rack in the center of your oven');
    expect(method).toContain('## Notes');
    expect(method).toContain('## Nutrition');
    expect(method).toContain('CALORIES: 177kcal');
  });

  it('reports an error for empty input', () => {
    const result = textImporter.parse('   ');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.data).toBeUndefined();
  });

  it('still succeeds with a minimal title-only input but warns', () => {
    const result = textImporter.parse('Quick Snack');
    expect(result.errors).toEqual([]);
    expect(result.data?.title).toBe('Quick Snack');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('accepts "Instructions:" as an alias for directions', () => {
    const input = `Test Recipe

Ingredients:
1 cup water

Instructions:
Boil the water.`;
    const result = textImporter.parse(input);
    expect(result.data?.method).toContain('1. Boil the water.');
  });

  it('tolerates CRLF line endings', () => {
    const input = SAMPLE.replace(/\n/g, '\r\n');
    const result = textImporter.parse(input);
    expect(result.data?.title).toBe('Bacon Wrapped Asparagus');
    expect(result.data?.parsed_ingredients.length).toBe(4);
  });

  it('exposes a stable importer id and label', () => {
    expect(textImporter.id).toBe('text');
    expect(textImporter.label).toBe('Plain Text');
  });
});
