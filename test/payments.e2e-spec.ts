import { INestApplication } from '@nestjs/common';

import { E2EUser, bearer, createTestApp, http, registerUser, uniqueEmail } from './app.helper';

/**
 * Payments API under `PAYMENTS_TEST_MODE` (expansion plan §5.7 — manual QA
 * of the desktop build): the whole purchase flow must work without any real
 * payment service provider.
 *
 *   GET  /payments/config      → { testMode: true }  (public capability flag)
 *   POST /payments             → PENDING payment (server-side pricing)
 *   POST /payments/:id/google-pay → SUCCEEDED via the local test gateway
 *   GET  /subscriptions/me     → ACTIVE / PREMIUM for ~30 days
 */
describe('Payments API (e2e, PAYMENTS_TEST_MODE)', () => {
  let app: INestApplication;
  let user: E2EUser;
  let paymentId: string;

  beforeAll(async () => {
    // Must be set before the app compiles: the payment config factory parses
    // the environment when the module instantiates its providers.
    process.env.PAYMENTS_TEST_MODE = 'true';
    app = await createTestApp();
    user = await registerUser(app, uniqueEmail('pay'));
  });

  afterAll(async () => {
    await app.close();
    // Never leak the flag into other spec files sharing this worker.
    delete process.env.PAYMENTS_TEST_MODE;
  });

  it('exposes the client payment configuration publicly → 200 { testMode: true }', async () => {
    const res = await http(app).get('/payments/config');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ testMode: true });
  });

  it('starts with an INACTIVE / FREE subscription → 200', async () => {
    const res = await http(app).get('/subscriptions/me').set(bearer(user.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('INACTIVE');
    expect(res.body.plan).toBe('FREE');
  });

  it('creates a PENDING payment with server-side pricing → 201', async () => {
    const res = await http(app)
      .post('/payments')
      .set(bearer(user.accessToken))
      .send({ plan: 'PREMIUM', paymentMethod: 'GOOGLE_PAY' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.amount).toBe(999);
    expect(res.body.currency).toBe('USD');
    expect(typeof res.body.id).toBe('string');
    paymentId = res.body.id;
  });

  it('completes the payment through the local test gateway → 200 SUCCEEDED', async () => {
    const res = await http(app)
      .post(`/payments/${paymentId}/google-pay`)
      .set(bearer(user.accessToken))
      // Placeholder token: the test gateway never inspects it.
      .send({ tokenData: { type: 'TEST', token: 'test-mode' } });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SUCCEEDED');
    expect(res.body.providerPaymentId).toBe(`test_${paymentId}`);
  });

  it("activates the user's Premium subscription for 30 days → 200", async () => {
    const res = await http(app).get('/subscriptions/me').set(bearer(user.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.plan).toBe('PREMIUM');

    const daysLeft = (new Date(res.body.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(daysLeft).toBeGreaterThan(29);
    expect(daysLeft).toBeLessThanOrEqual(30.5);
  });

  it('serves the payment as terminal SUCCEEDED on read → 200', async () => {
    const res = await http(app).get(`/payments/${paymentId}`).set(bearer(user.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SUCCEEDED');
  });

  it("rejects reading another user's payment → 404", async () => {
    const other = await registerUser(app, uniqueEmail('pay-other'));
    const res = await http(app).get(`/payments/${paymentId}`).set(bearer(other.accessToken));

    expect(res.status).toBe(404);
  });

  it('requires authentication for the purchase endpoints → 401', async () => {
    const create = await http(app).post('/payments').send({ plan: 'PREMIUM', paymentMethod: 'GOOGLE_PAY' });
    const submit = await http(app)
      .post(`/payments/${paymentId}/google-pay`)
      .send({ tokenData: { type: 'TEST', token: 'test-mode' } });

    expect(create.status).toBe(401);
    expect(submit.status).toBe(401);
  });
});
