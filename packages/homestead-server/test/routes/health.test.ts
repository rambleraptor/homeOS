import { afterEach, describe, expect, test, vi } from 'vitest';
import { Database } from '../../src/engine/sqlite';
import { makeHealthRoute } from '../../src/routes/health';

describe('health route', () => {
  afterEach(() => vi.restoreAllMocks());

  test('reports ok when the database responds', async () => {
    const db = new Database(':memory:');
    const res = await makeHealthRoute(db).request('/');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, status: 'ok' });
    db.close();
  });

  test('reports 503 when the database is unreachable', async () => {
    // Silence the expected error log so the suite output stays clean.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = new Database(':memory:');
    db.close(); // querying a closed handle throws — stands in for an unreachable DB
    const res = await makeHealthRoute(db).request('/');
    expect(res.status).toBe(503);
    const body = (await res.json()) as { ok: boolean; status: string };
    expect(body.ok).toBe(false);
    expect(body.status).toBe('error');
  });
});
