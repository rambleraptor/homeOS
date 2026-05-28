import { Hono } from 'hono';
import { parseOmniboxRequest } from '@rambleraptor/homestead-core/server/omnibox';

export const omniboxRoute = new Hono();

omniboxRoute.post('/parse', (c) => parseOmniboxRequest(c.req.raw));
