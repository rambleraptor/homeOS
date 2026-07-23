/**
 * Minimal list-filter parser. The Go server accepted CEL expressions; no
 * consumer ever passed a filter, so the TS engine supports the practical
 * subset — comparisons (==, !=, <, <=, >, >=) on schema fields combined with
 * && / || and parentheses — compiled to parameterized SQL.
 */

import type { Schema } from './types';
import { STANDARD_FIELDS } from './types';
import { derivedColumnsFromSchema } from './db';

export interface CompiledFilter {
  sql: string;
  params: (string | number)[];
}

type Token =
  | { kind: 'ident'; value: string }
  | { kind: 'string'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'bool'; value: boolean }
  | { kind: 'op'; value: string };

class FilterError extends Error {}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i]!;
    if (c === ' ' || c === '\t' || c === '\n') {
      i++;
      continue;
    }
    if (c === '(' || c === ')') {
      tokens.push({ kind: 'op', value: c });
      i++;
      continue;
    }
    const two = input.slice(i, i + 2);
    if (two === '==' || two === '!=' || two === '<=' || two === '>=' || two === '&&' || two === '||') {
      tokens.push({ kind: 'op', value: two });
      i += 2;
      continue;
    }
    if (c === '<' || c === '>') {
      tokens.push({ kind: 'op', value: c });
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      const end = input.indexOf(c, i + 1);
      if (end === -1) throw new FilterError('unterminated string literal');
      tokens.push({ kind: 'string', value: input.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '-' && /[0-9]/.test(input[i + 1] ?? ''))) {
      const m = /^-?\d+(\.\d+)?/.exec(input.slice(i))!;
      tokens.push({ kind: 'number', value: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      // Dotted paths (`metadata.box_1_interest`) tokenize as one identifier;
      // parseOperand resolves them against a union field's derived columns.
      const m = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*/.exec(
        input.slice(i),
      )!;
      const word = m[0];
      if (word === 'true' || word === 'false') {
        tokens.push({ kind: 'bool', value: word === 'true' });
      } else {
        tokens.push({ kind: 'ident', value: word });
      }
      i += word.length;
      continue;
    }
    throw new FilterError(`unexpected character ${JSON.stringify(c)}`);
  }
  return tokens;
}

const COMPARISON_OPS: Record<string, string> = {
  '==': '=',
  '!=': '!=',
  '<': '<',
  '<=': '<=',
  '>': '>',
  '>=': '>=',
};

/**
 * Compile a filter expression to a parameterized SQL fragment. Throws
 * Error("invalid filter: ...") on parse failures or unknown fields, which
 * the list handler maps to a 400 — same contract as the Go server.
 */
export function compileFilter(filter: string, schema: Schema): CompiledFilter {
  try {
    const tokens = tokenize(filter);
    const fields = new Set(
      Object.keys(schema.properties ?? {}).filter((n) => !STANDARD_FIELDS.has(n)),
    );
    // Union paths (`metadata.doc_type`) resolve to the derived column the DDL
    // generated for them, so a filter seeks an index instead of scanning.
    const derived = new Map(
      derivedColumnsFromSchema(schema).map((c) => [c.path, c.name]),
    );
    let pos = 0;

    const peek = () => tokens[pos];
    const next = () => tokens[pos++];
    const expectOp = (value: string) => {
      const t = next();
      if (!t || t.kind !== 'op' || t.value !== value) {
        throw new FilterError(`expected ${JSON.stringify(value)}`);
      }
    };

    const params: (string | number)[] = [];

    function parseOperand(): { sql: string; isField: boolean } {
      const t = next();
      if (!t) throw new FilterError('unexpected end of filter');
      switch (t.kind) {
        case 'ident': {
          const column = fields.has(t.value) ? t.value : derived.get(t.value);
          if (!column) {
            throw new FilterError(`unknown field ${JSON.stringify(t.value)}`);
          }
          // Extracted-text columns are encrypted at rest, so a SQL comparison
          // would match ciphertext and silently return nothing. Reject it.
          if (schema.properties?.[t.value]?.['x-aepbase-file-text-field'] === true) {
            throw new FilterError(`field ${JSON.stringify(t.value)} is encrypted and cannot be filtered`);
          }
          return { sql: column, isField: true };
        }
        case 'string':
          params.push(t.value);
          return { sql: '?', isField: false };
        case 'number':
          params.push(t.value);
          return { sql: '?', isField: false };
        case 'bool':
          params.push(t.value ? 1 : 0); // booleans are stored as 0/1
          return { sql: '?', isField: false };
        default:
          throw new FilterError(`unexpected token ${JSON.stringify(t.value)}`);
      }
    }

    function parseComparison(): string {
      const t = peek();
      if (t?.kind === 'op' && t.value === '(') {
        next();
        const inner = parseOr();
        expectOp(')');
        return `(${inner})`;
      }
      const left = parseOperand();
      const opTok = next();
      if (!opTok || opTok.kind !== 'op' || !(opTok.value in COMPARISON_OPS)) {
        throw new FilterError('expected comparison operator');
      }
      const right = parseOperand();
      if (!left.isField && !right.isField) {
        throw new FilterError('comparison must reference a field');
      }
      return `${left.sql} ${COMPARISON_OPS[opTok.value]} ${right.sql}`;
    }

    function parseAnd(): string {
      let sql = parseComparison();
      while (peek()?.kind === 'op' && peek()?.value === '&&') {
        next();
        sql = `${sql} AND ${parseComparison()}`;
      }
      return sql;
    }

    function parseOr(): string {
      let sql = parseAnd();
      while (peek()?.kind === 'op' && peek()?.value === '||') {
        next();
        sql = `(${sql} OR ${parseAnd()})`;
      }
      return sql;
    }

    const sql = parseOr();
    if (pos !== tokens.length) throw new FilterError('unexpected trailing tokens');
    return { sql, params };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`invalid filter: ${msg}`);
  }
}
