import { describe, expect, it } from 'vitest';
import { resolveDocumentPersonIds } from '../personLinks';
import type { Document } from '../types';
import type { Person } from '../../people/types';

/** Minimal directory person — resolution only reads `name`/`aliases`/`id`. */
function person(id: string, name: string, aliases: string[] = []): Person {
  return { id, name, aliases, addresses: [], created_by: '', created: '', updated: '' };
}

function doc(metadata: Document['metadata']): Document {
  return { id: 'd1', path: 'documents/d1', metadata };
}

const jane = person('p-jane', 'Jane Doe', ['Janey']);
const bob = person('p-bob', 'Robert Smith', ['Bob Smith']);
const directory = [jane, bob];

describe('resolveDocumentPersonIds', () => {
  it('resolves an extracted name to its directory person id', () => {
    // form-w2 flags `employee_name` as a person field.
    const d = doc({ doc_type: 'form-w2', employee_name: 'Jane Doe' });
    expect(resolveDocumentPersonIds(d, directory)).toEqual(['p-jane']);
  });

  it('follows aliases and longer printed names (token subset)', () => {
    const d = doc({ doc_type: 'form-w2', employee_name: 'Jane Marie Doe' });
    expect(resolveDocumentPersonIds(d, directory)).toEqual(['p-jane']);
  });

  it('drops names the directory does not know', () => {
    const d = doc({ doc_type: 'form-w2', employee_name: 'Nobody Special' });
    expect(resolveDocumentPersonIds(d, directory)).toEqual([]);
  });

  it('returns [] for an unparsed document with no metadata', () => {
    expect(resolveDocumentPersonIds(doc(undefined), directory)).toEqual([]);
  });

  it('dedupes when the same person is named more than once', () => {
    // medical-receipt flags `patient` as a person field.
    const d = doc({ doc_type: 'medical-receipt', patient: 'Bob Smith' });
    // Bob's canonical id, once, even though "Bob Smith" is an alias spelling.
    expect(resolveDocumentPersonIds(d, directory)).toEqual(['p-bob']);
  });
});
