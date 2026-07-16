/**
 * `GET /api/bulk-import/:plural/template?format=<id>` — download a format's
 * starter file (a CSV header row, typically).
 *
 * Its own route rather than part of the custom method: this is a browser
 * navigation that must return a file with `Content-Disposition`, not the JSON a
 * custom method speaks. Templates are static, public schema documentation —
 * they contain no household data, so they need no auth, same as
 * `/api/custom-methods`.
 */

import { Hono } from 'hono';
import { getResourceBulkImport } from '@rambleraptor/homestead-core/apps/registry';

export const bulkImportTemplateRoute = new Hono();

bulkImportTemplateRoute.get('/:plural/template', async (c) => {
  const plural = c.req.param('plural');
  const def = getResourceBulkImport(plural);
  if (!def) return c.json({ error: `${plural} does not support bulk import` }, 404);

  const formatId = c.req.query('format');
  const format = def.formats.find((f) => f.id === formatId);
  if (!format) return c.json({ error: `Unknown format ${formatId}` }, 400);

  // The template ships with the parser (server-only), so serving it means
  // loading that module — fine here, since this route only ever runs on the
  // server and ESM caches the import.
  const { template } = await format.load();
  if (!template) {
    return c.json({ error: `Format ${format.id} has no template` }, 404);
  }

  return new Response(template(), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${plural}-import-template.csv"`,
    },
  });
});
