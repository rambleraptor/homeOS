import { Hono } from 'hono';
import { handleChat } from '../app-registry';

export const chatRoute = new Hono();

chatRoute.post('/', (c) => handleChat(c.req.raw));
