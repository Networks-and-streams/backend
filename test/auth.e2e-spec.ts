import { INestApplication } from '@nestjs/common';

import { bearer, createTestApp, http, refreshCookieFrom, setCookiesFrom, uniqueEmail } from './app.helper';

/**
 * End-to-end coverage of the auth lifecycle (expansion plan §2.4):
 * register → login → status → refresh (rotation) → logout, plus the
 * rejection paths. Runs against the real `AppModule` and the `streams_test`
 * database.
 */
describe('Auth API (e2e)', () => {
  let app: INestApplication;

  const email = uniqueEmail('auth');
  const password = 'e2e-password';

  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a new user → 201 with an access token and a refresh cookie', async () => {
    const res = await http(app).post('/auth/register').send({ email, password });

    expect(res.status).toBe(201);
    expect(typeof res.body.accessToken).toBe('string');

    accessToken = res.body.accessToken;
    refreshToken = refreshCookieFrom(res);

    // The cookie is HttpOnly and must not be the access token.
    const cookieHeader = setCookiesFrom(res).find((c) => c.startsWith('refreshToken='));
    expect(cookieHeader).toContain('HttpOnly');
    expect(refreshToken).not.toBe(accessToken);
  });

  it('rejects a duplicate registration → 400', async () => {
    const res = await http(app).post('/auth/register').send({ email, password });

    expect(res.status).toBe(400);
    expect(String(res.body.message)).toContain('already exists');
  });

  it('rejects a malformed payload → 400 with per-field messages', async () => {
    const res = await http(app).post('/auth/register').send({ email: 'not-an-email', password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.statusCode).toBe(400);
    expect(Array.isArray(res.body.message)).toBe(true);
  });

  it('logs in → 200 with a fresh access token', async () => {
    const res = await http(app).post('/auth/login').send({ email, password });

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(refreshCookieFrom(res)).toBeTruthy();
  });

  it('rejects a wrong password → 401', async () => {
    const res = await http(app).post('/auth/login').send({ email, password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.accessToken).toBeUndefined();
  });

  it('rejects GET /auth/status without a token → 401', async () => {
    const res = await http(app).get('/auth/status');

    expect(res.status).toBe(401);
  });

  it('returns the caller profile from GET /auth/status → 200', async () => {
    const res = await http(app).get('/auth/status').set(bearer(accessToken));

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
    expect(typeof res.body.id).toBe('string');
    expect(typeof res.body.sid).toBe('string');
  });

  it('rotates tokens on POST /auth/refresh → 200', async () => {
    const staleRefreshToken = refreshToken;

    const res = await http(app)
      .post('/auth/refresh')
      .set('Cookie', [`refreshToken=${refreshToken}`]);

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');

    // The rotated access token is immediately usable.
    const status = await http(app).get('/auth/status').set(bearer(res.body.accessToken));
    expect(status.status).toBe(200);
    expect(status.body.email).toBe(email);

    accessToken = res.body.accessToken;
    refreshToken = refreshCookieFrom(res);

    // Rotation: the very same cookie must now be rejected.
    const replay = await http(app)
      .post('/auth/refresh')
      .set('Cookie', [`refreshToken=${staleRefreshToken}`]);
    expect(replay.status).toBe(401);
  });

  it('logs out → 200, clears the cookie and revokes the session', async () => {
    const res = await http(app)
      .post('/auth/logout')
      .set(bearer(accessToken))
      .set('Cookie', [`refreshToken=${refreshToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('logged out');

    const cookies = setCookiesFrom(res);
    expect(cookies.some((c) => c.startsWith('refreshToken=;'))).toBe(true);
  });

  it('refuses to refresh after logout', async () => {
    const res = await http(app)
      .post('/auth/refresh')
      .set('Cookie', [`refreshToken=${refreshToken}`]);

    // The session row is gone, so the refresh lookup fails (404) even though
    // the JWT itself still verifies.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.accessToken).toBeUndefined();
  });
});
