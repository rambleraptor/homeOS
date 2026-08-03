import { Hono } from 'hono';
import { handleChat, aiConfig } from '../app-registry';

export const chatRoute = new Hono();

// Cheap availability probe (no model call): reports whether the operator has
// configured an `ai` block. The dashboard's admin checklist uses this to check
// off "enable the AI assistant".
chatRoute.get('/', (c) => c.json({ configured: aiConfig() != null }));

chatRoute.post('/', (c) => handleChat(c.req.raw));
