import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { INestApplication } from '@nestjs/common';

/**
 * Desktop single-port mode (expansion plan §5.1/§5.3): the backend serves the
 * built frontend (`SERVE_STATIC_DIR`) and rewrites `/api/*` → `/*`, so one
 * origin exposes both the SPA and the API.
 *
 * The flag is read while `AppModule` is evaluated (module-level spread in
 * `app.module.ts`), therefore it must be set BEFORE `./app.helper` — and with
 * it `AppModule` — is imported. Jest isolates the module registry per test
 * file, hence the dynamic import inside `beforeAll`.
 */
const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-static-e2e-'));
fs.writeFileSync(path.join(staticDir, 'index.html'), '<div id="root">SPA-INDEX</div>');
process.env.SERVE_STATIC_DIR = staticDir;

// `.js` extension: required by `moduleResolution: nodenext` for the dynamic
// import (jest's moduleNameMapper strips it back to `./app.helper` at runtime).
type Helper = typeof import('./app.helper.js');

describe('Desktop static serving (e2e)', () => {
  let app: INestApplication;
  let helper: Helper;

  beforeAll(async () => {
    helper = await import('./app.helper.js');
    app = await helper.createTestApp();
  }, 60000);

  afterAll(async () => {
    await app?.close();
    delete process.env.SERVE_STATIC_DIR;
    fs.rmSync(staticDir, { recursive: true, force: true });
  });

  it('serves index.html at /', async () => {
    const res = await helper.http(app).get('/');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('SPA-INDEX');
  });

  it('falls back to index.html for client-side routes', async () => {
    const res = await helper.http(app).get('/some/spa/route');

    expect(res.status).toBe(200);
    expect(res.text).toContain('SPA-INDEX');
  });

  it('strips the /api prefix so the SPA can call the API on one origin', async () => {
    // Reachable only after the prefix rewrite — the backend has no /api routes.
    const res = await helper.http(app).get('/api/auth/status');

    // The real route exists and enforces auth (401 = the guard answered).
    expect(res.status).toBe(401);
  });

  it('keeps unprefixed API routes working', async () => {
    const res = await helper.http(app).get('/auth/status');

    expect(res.status).toBe(401);
  });

  it('exposes GET /health with and without the /api prefix (no auth)', async () => {
    const direct = await helper.http(app).get('/health');
    const prefixed = await helper.http(app).get('/api/health');

    expect(direct.status).toBe(200);
    expect(direct.body).toEqual({ status: 'ok' });
    expect(prefixed.status).toBe(200);
    expect(prefixed.body).toEqual({ status: 'ok' });
  });

  it('does not serve the SPA for API paths that do not exist as HTML', async () => {
    // POSTs must never be answered by the SPA fallback (GET-only renderPath).
    const res = await helper.http(app).post('/api/definitely-missing').send({});

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.text).not.toContain('SPA-INDEX');
  });
});
