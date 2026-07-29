import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';

export const RECIPES = 'recipes' as const;
export const RECIPE_LOGS = 'logs' as const;

export const recipesResources: ResourceDefinition[] = [
  {
    singular: 'recipe',
    plural: RECIPES,
    description: 'A culinary recipe with parsed ingredients for scaling.',
    user_settable_create: true,
    // No `save`: an imported recipe is one plain record, and importers never
    // produce an image, so the default one-create-per-item saver is enough.
    bulkImport: {
      formats: [
        {
          id: 'text',
          label: 'Plain Text',
          inputType: 'text',
          load: () => import('./methods/bulk-import-text'),
        },
        {
          id: 'paprika',
          label: 'Paprika',
          inputType: 'file',
          accept: '.paprikarecipe,.paprikarecipes',
          multiple: true,
          load: () => import('./methods/bulk-import-paprika'),
        },
      ],
    },
    fields: {
      title: {
        type: 'string',
        description: 'Display name of the recipe.',
        required: true,
      },
      source_pointer: {
        type: 'string',
        description:
          "URI or physical reference (e.g. 'https://...' or 'Book: Food Lab pg 124').",
      },
      // Set when a recipe was created from a classified document. Cascade:
      // deleting the source document deletes this derived recipe. Distinct from
      // the free-text `source_pointer`, which holds a printed/URL source.
      source_document: {
        type: 'string',
        reference: { resource: 'document', onDelete: 'cascade' },
        description: 'The source document this recipe was derived from.',
      },
      parsed_ingredients: {
        type: 'array',
        description:
          'Structured ingredient list separated from quantities for scaling.',
        required: true,
        items: {
          type: 'object',
          properties: {
            item: {
              type: 'string',
              description: 'Normalized ingredient name.',
            },
            qty: {
              type: 'number',
              description: 'Numerical quantity (decimal for fractions).',
            },
            unit: {
              type: 'string',
              description:
                'Standardized unit (cup, tsp, g, whole, ...).',
            },
            notes: {
              type: 'string',
              description:
                'Substitutions or other context (e.g. "or 8 thighs, 4 breasts", "to taste").',
            },
            raw: {
              type: 'string',
              description: 'Original unparsed ingredient string.',
            },
          },
        },
      },
      method: {
        type: 'string',
        description:
          'Free-form notes, nutrition, or other context (Markdown).',
      },
      steps: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Ordered cooking steps. Rendered as a numbered list.',
      },
      prep_time: {
        type: 'string',
        description: "Human-readable prep time (e.g. '10 mins').",
      },
      cook_time: {
        type: 'string',
        description: "Human-readable cook time (e.g. '25 mins').",
      },
      servings: {
        type: 'string',
        description: "Human-readable yield / servings (e.g. '8 bundles').",
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Categorical tags for filtering and menu generation.',
      },
      image: {
        type: 'file',
        description: 'Recipe photo (jpeg/png/webp/gif, <=5MB).',
      },
      created_by: { type: 'string', reference: { resource: 'user' } },
    },
  },
  {
    singular: 'log',
    plural: RECIPE_LOGS,
    description:
      'A single cooking attempt of a recipe with outcome and notes.',
    user_settable_create: true,
    parents: ['recipe'],
    fields: {
      date: { type: 'string', format: 'date-time', required: true },
      notes: { type: 'string' },
      success: { type: 'boolean' },
      rating: { type: 'number', description: '1-5 scale' },
      deviated: { type: 'boolean' },
      deviation_notes: { type: 'string' },
      created_by: { type: 'string', reference: { resource: 'user' } },
    },
  },
];
