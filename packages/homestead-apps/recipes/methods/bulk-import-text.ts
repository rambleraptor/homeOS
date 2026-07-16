/**
 * Recipes "paste some text" import format.
 *
 * Server-only (under `methods/`, so the client build stubs it out). The parsing
 * itself still lives in `../importers/textImporter` — this is just the adapter
 * that presents it to the bulk-import framework.
 */

import type {
  BulkImportParser,
  ParsedItem,
} from '@rambleraptor/homestead-core/resources/bulk-import/types';
import { textImporter } from '../importers/textImporter';
import { toParsedItems } from './recipe-import-adapter';

const parser: BulkImportParser = {
  parse(input): ParsedItem[] {
    return toParsedItems([textImporter.parse(input.text ?? '')]);
  },
};

export default parser;
