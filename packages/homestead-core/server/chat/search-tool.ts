/**
 * The chat assistant's semantic-search tool over embedded file fields.
 *
 * Auto-registered (only) when some resource has an `ai.embed` file field and an
 * embedding provider is configured — so it lights up with no per-app wiring, the
 * same way the CRUD tools derive from resource defs. It embeds the user's
 * question, finds the nearest chunks in the vector store, and returns passages
 * with citations for the model to quote.
 *
 * The vector index has no row-level scoping, so a raw hit could reference a
 * record the caller can't see. Every hit is therefore verified with `aepGet`
 * under the caller's own token — inaccessible records are dropped — so search
 * can never surface more than the user could read directly.
 */

import { z } from 'zod';
import { aepGet } from '../aepbase';
import { isEmbeddingConfigured } from '../ai/config';
import { aiEmbed, tool } from '../ai/generate';
import { fileEmbeds } from '../../resources/ai-fields';
import type { ResourceDefinition } from '../../resources/types';
import { getVectorStore } from '../vectors/store';
import type { ChatToolCall } from '../../chat/types';

/** The tool's exposed name, referenced by the system prompt. */
export const SEARCH_TOOL_NAME = 'search_documents';

const MAX_LIMIT = 10;
const DEFAULT_LIMIT = 5;
/** Over-fetch candidates so access-filtering can still fill `limit`. */
const CANDIDATE_FACTOR = 4;

/** Top-level resources with at least one embedded file field. */
function embeddedResources(defs: ResourceDefinition[]): ResourceDefinition[] {
  return defs.filter(
    (def) => !def.parents?.length && Object.values(def.fields).some(fileEmbeds),
  );
}

/** A resource's display title from a fetched record, if it has one. */
function pickTitle(record: unknown): string | undefined {
  if (!record || typeof record !== 'object') return undefined;
  const r = record as { title?: unknown; name?: unknown };
  if (typeof r.title === 'string' && r.title) return r.title;
  if (typeof r.name === 'string' && r.name) return r.name.split('/').filter(Boolean).pop();
  return undefined;
}

/**
 * Build the search tool, or return null when it shouldn't exist (no embedded
 * resources, or embedding/vector store unconfigured). `record` captures the
 * call for the response's `toolCalls`, matching the CRUD tools.
 */
export function makeSearchTool(opts: {
  defs: ResourceDefinition[];
  token: string;
  record: (call: ChatToolCall) => void;
}) {
  const resources = embeddedResources(opts.defs);
  if (resources.length === 0 || !isEmbeddingConfigured() || !getVectorStore()) {
    return null;
  }

  const plurals = resources.map((d) => d.plural);
  const pluralToSingular = new Map(resources.map((d) => [d.plural, d.singular]));
  const singularToPlural = new Map(resources.map((d) => [d.singular, d.plural]));

  const resourcesParam = z
    .array(z.enum(plurals as [string, ...string[]]))
    .optional()
    .describe('Restrict the search to these resource types. Omit to search all.');

  const inputSchema = z.object({
    query: z.string().describe('The natural-language question or topic to search for.'),
    resources: resourcesParam,
    limit: z
      .number()
      .int()
      .optional()
      .describe(`Max passages to return (default ${DEFAULT_LIMIT}, max ${MAX_LIMIT}).`),
  });

  return tool({
    description:
      'Search the full text of uploaded files (' +
      plurals.join(', ') +
      ') by meaning, not just keywords. Use this to answer questions about the ' +
      'contents of documents. Returns matching passages with a citation (the ' +
      'resource type and record id) you should reference in your answer.',
    inputSchema,
    execute: async (args: z.infer<typeof inputSchema>) => {
      const { query } = args;
      const limit = Math.min(Math.max(args.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
      const store = getVectorStore();
      if (!store) {
        const out = { error: 'Document search is not available.' };
        opts.record({ tool: SEARCH_TOOL_NAME, args, ok: false, error: out.error });
        return out;
      }

      const wantSingulars = args.resources
        ?.map((p) => pluralToSingular.get(p))
        .filter((s): s is string => Boolean(s));

      const [vector] = await aiEmbed([query]);
      const hits = await store.search({
        vector,
        limit: limit * CANDIDATE_FACTOR,
        resources: wantSingulars,
      });

      // Verify access once per record (a doc can contribute several chunks).
      const accessCache = new Map<string, { title?: string } | null>();
      const results: Array<{
        resource: string;
        id: string;
        field: string;
        title?: string;
        passage: string;
        score: number;
      }> = [];

      for (const hit of hits) {
        if (results.length >= limit) break;
        const plural = singularToPlural.get(hit.resource);
        if (!plural) continue;
        const key = `${plural}/${hit.record}`;
        let rec = accessCache.get(key);
        if (rec === undefined) {
          try {
            rec = { title: pickTitle(await aepGet(plural, hit.record, opts.token)) };
          } catch {
            rec = null; // inaccessible or gone — drop from results
          }
          accessCache.set(key, rec);
        }
        if (rec === null) continue;
        results.push({
          resource: plural,
          id: hit.record,
          field: hit.field,
          title: rec.title,
          passage: hit.text,
          score: Number(hit.score.toFixed(4)),
        });
      }

      opts.record({
        tool: SEARCH_TOOL_NAME,
        args,
        ok: true,
        result: { count: results.length },
      });
      return { results };
    },
  });
}
