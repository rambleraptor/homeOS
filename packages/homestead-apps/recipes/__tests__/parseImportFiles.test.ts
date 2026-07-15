import { describe, it, expect } from 'vitest';
import { parseImportFiles } from '../components/RecipeImportModal';
import type {
  FileRecipeImporter,
  RecipeImportResult,
} from '../importers/types';
import type { RecipeFormData } from '../types';

function recipe(title: string): RecipeFormData {
  return { title, parsed_ingredients: [] };
}

function file(name: string): File {
  return new File(['x'], name);
}

/**
 * A stub importer whose `parseFile` looks up a canned result by the file's
 * name, so tests can script per-file success / warnings / errors.
 */
function stubImporter(
  results: Record<string, RecipeImportResult>,
): FileRecipeImporter {
  return {
    id: 'stub',
    label: 'Stub',
    inputType: 'file',
    accept: '.stub',
    parseFile: (f: File) =>
      Promise.resolve(
        results[f.name] ?? { warnings: [], errors: ['no result'] },
      ),
  };
}

describe('parseImportFiles', () => {
  it('flattens recipes from several files into data + additional', async () => {
    const importer = stubImporter({
      'a.stub': { data: recipe('A'), warnings: [], errors: [] },
      'b.stub': {
        data: recipe('B1'),
        additional: [recipe('B2')],
        warnings: [],
        errors: [],
      },
    });

    const res = await parseImportFiles(importer, [file('a.stub'), file('b.stub')]);

    expect(res.data?.title).toBe('A');
    expect(res.additional?.map((r) => r.title)).toEqual(['B1', 'B2']);
    expect(res.errors).toEqual([]);
  });

  it('leaves additional undefined for a single recipe', async () => {
    const importer = stubImporter({
      'a.stub': { data: recipe('A'), warnings: [], errors: [] },
    });

    const res = await parseImportFiles(importer, [file('a.stub')]);

    expect(res.data?.title).toBe('A');
    expect(res.additional).toBeUndefined();
  });

  it('demotes a failing file to a prefixed warning when others succeed', async () => {
    const importer = stubImporter({
      'good.stub': { data: recipe('Good'), warnings: [], errors: [] },
      'bad.stub': { warnings: [], errors: ['Unrecognized file format.'] },
    });

    const res = await parseImportFiles(importer, [
      file('good.stub'),
      file('bad.stub'),
    ]);

    expect(res.data?.title).toBe('Good');
    expect(res.errors).toEqual([]);
    expect(res.warnings).toContain('bad.stub: Unrecognized file format.');
  });

  it('surfaces a fatal error (unprefixed) for a single failing file', async () => {
    const importer = stubImporter({
      'bad.stub': { warnings: [], errors: ['Unrecognized file format.'] },
    });

    const res = await parseImportFiles(importer, [file('bad.stub')]);

    expect(res.data).toBeUndefined();
    expect(res.errors).toEqual(['Unrecognized file format.']);
  });

  it('reports a fallback error when every file yields no recipes', async () => {
    const importer = stubImporter({
      'a.stub': { warnings: ['odd'], errors: [] },
      'b.stub': { warnings: ['odd'], errors: [] },
    });

    const res = await parseImportFiles(importer, [file('a.stub'), file('b.stub')]);

    expect(res.data).toBeUndefined();
    expect(res.errors).toEqual(['No recipes found in the selected files.']);
  });

  it('prefixes per-file warnings and captures thrown parse failures', async () => {
    const importer: FileRecipeImporter = {
      id: 'stub',
      label: 'Stub',
      inputType: 'file',
      accept: '.stub',
      parseFile: (f: File) => {
        if (f.name === 'throws.stub') {
          return Promise.reject(new Error('boom'));
        }
        return Promise.resolve({
          data: recipe('OK'),
          warnings: ['heads up'],
          errors: [],
        });
      },
    };

    const res = await parseImportFiles(importer, [
      file('ok.stub'),
      file('throws.stub'),
    ]);

    expect(res.data?.title).toBe('OK');
    expect(res.warnings).toContain('ok.stub: heads up');
    expect(res.warnings).toContain('throws.stub: boom');
  });
});
