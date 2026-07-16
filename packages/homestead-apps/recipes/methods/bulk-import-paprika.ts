/**
 * Recipes Paprika import format (`.paprikarecipe` / `.paprikarecipes`).
 *
 * Server-only (under `methods/`, so the client build stubs it out). The zip /
 * gzip reading lives in `../importers/paprikaImporter` — this is just the
 * adapter. It runs under Bun and Node, both of which have the
 * `DecompressionStream` and `File` globals the importer relies on.
 */

import type {
  BulkImportParser,
  ParsedItem,
} from '@rambleraptor/homestead-core/resources/bulk-import/types';
import { paprikaImporter } from '../importers/paprikaImporter';
import type { RecipeImportResult } from '../importers/types';
import { toParsedItems } from './recipe-import-adapter';

const parser: BulkImportParser = {
  async parse(input): Promise<ParsedItem[]> {
    const files = input.files ?? [];
    const results: RecipeImportResult[] = [];

    for (const file of files) {
      try {
        // The importer reads a File (it only calls `.arrayBuffer()`); the
        // framework hands us decoded bytes.
        results.push(
          await paprikaImporter.parseFile(
            new File([file.bytes as BlobPart], file.name),
          ),
        );
      } catch (error) {
        // Becomes one errored item for this file — its siblings still import.
        results.push({
          warnings: [],
          errors: [error instanceof Error ? error.message : 'Could not read this file'],
        });
      }
    }

    return toParsedItems(
      results,
      files.map((f) => f.name),
    );
  },
};

export default parser;
