import { INestApplication } from '@nestjs/common';

import { E2EUser, bearer, createTestApp, http, registerUser, uniqueEmail } from './app.helper';

/**
 * `/subscriptions/me` coverage (expansion plan §2.4): a freshly registered
 * account must see the default `INACTIVE` / `FREE` state — the backend is the
 * source of truth for access decisions.
 */
describe('Subscriptions API (e2e)', () => {
  let app: INestApplication;
  let user: E2EUser;

  beforeAll(async () => {
    app = await createTestApp();
    user = await registerUser(app, uniqueEmail('subs'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication → 401', async () => {
    const res = await http(app).get('/subscriptions/me');

    expect(res.status).toBe(401);
  });

  it('returns the default INACTIVE subscription of a fresh account → 200', async () => {
    const res = await http(app).get('/subscriptions/me').set(bearer(user.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('INACTIVE');
    expect(res.body.plan).toBe('FREE');
    expect(typeof res.body.userId).toBe('string');
    expect(res.body.startedAt).toBeNull();
    expect(res.body.expiresAt).toBeNull();
    expect(typeof res.body.id).toBe('string');
  });

  it('rejects an invalid token → 401', async () => {
    const res = await http(app).get('/subscriptions/me').set(bearer('not-a-jwt'));

    expect(res.status).toBe(401);
  });
});
