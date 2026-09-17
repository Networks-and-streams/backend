import { SubscriptionPlan } from '@/generated/prisma/client';

import { StripeGateway } from './stripe.gateway';

/* ------------------------------------------------------------------ */
/* Stripe SDK mock                                                     */
/* ------------------------------------------------------------------ */

// Minimal mock that covers every Stripe API surface the gateway touches.
function createStripeMock() {
  return {
    paymentIntents: {
      create: jest.fn(),
      retrieve: jest.fn(),
    },
    paymentMethods: {
      create: jest.fn(),
      retrieve: jest.fn(),
    },
    refunds: {
      create: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  };
}

// Mock the `stripe` default export so the gateway imports our mock.
jest.mock('stripe', () => {
  const StripeMock = jest.fn().mockImplementation(() => createStripeMock());
  return { __esModule: true, default: StripeMock };
});

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function makeGateway() {
  const gateway = new StripeGateway('sk_test_fake', 'whsec_test_fake');
  // Access the internal Stripe instance to inject mocks.
  const stripeMock = (gateway as unknown as { stripe: ReturnType<typeof createStripeMock> }).stripe;
  return { gateway, stripeMock };
}

const baseRequest = {
  userId: 'user-1',
  plan: SubscriptionPlan.PREMIUM,
  amount: 999,
  currency: 'USD',
};

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe('StripeGateway', () => {
  afterEach(() => jest.clearAllMocks());

  /* ---------------------------------------------------------------- */
  /* createPayment                                                     */
  /* ---------------------------------------------------------------- */

  describe('createPayment', () => {
    it('creates a Stripe PaymentIntent with correct amount/currency', async () => {
      const { gateway, stripeMock } = makeGateway();

      stripeMock.paymentIntents.create.mockResolvedValue({
        id: 'pi_abc123',
        client_secret: 'pi_abc123_secret_xyz',
        metadata: { userId: 'user-1', plan: 'PREMIUM' },
      });

      const result = await gateway.createPayment(baseRequest);

      expect(stripeMock.paymentIntents.create).toHaveBeenCalledWith({
        amount: 999,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: { userId: 'user-1', plan: SubscriptionPlan.PREMIUM },
      });

      expect(result.providerPaymentId).toBe('pi_abc123');
      expect(result.clientSecret).toBe('pi_abc123_secret_xyz');
    });

    it('normalizes currency to lowercase', async () => {
      const { gateway, stripeMock } = makeGateway();
      stripeMock.paymentIntents.create.mockResolvedValue({
        id: 'pi_1',
        client_secret: 'secret',
      });

      await gateway.createPayment({ ...baseRequest, currency: 'USD' });

      expect(stripeMock.paymentIntents.create).toHaveBeenCalledWith(expect.objectContaining({ currency: 'usd' }));
    });

    it('propagates Stripe API errors', async () => {
      const { gateway, stripeMock } = makeGateway();
      stripeMock.paymentIntents.create.mockRejectedValue(new Error('Invalid API key provided'));

      await expect(gateway.createPayment(baseRequest)).rejects.toThrow('Invalid API key');
    });
  });

  /* ---------------------------------------------------------------- */
  /* processGooglePay                                                  */
  /* ---------------------------------------------------------------- */

  describe('processGooglePay', () => {
    const googlePayRequest = {
      paymentId: 'pay-1',
      userId: 'user-1',
      plan: SubscriptionPlan.PREMIUM,
      amount: 999,
      currency: 'USD',
      tokenData: {
        paymentMethodData: {
          tokenizationData: {
            type: 'PAYMENT_GATEWAY',
            token: 'pm_test_google_pay_token',
          },
        },
      },
    };

    it('creates a PaymentMethod from the Google Pay token and confirms', async () => {
      const { gateway, stripeMock } = makeGateway();

      stripeMock.paymentMethods.retrieve.mockResolvedValue({
        id: 'pm_test_google_pay_token',
        type: 'card',
      });

      stripeMock.paymentIntents.create.mockResolvedValue({
        id: 'pi_google1',
        status: 'succeeded',
        metadata: {},
      });

      const result = await gateway.processGooglePay(googlePayRequest);

      expect(stripeMock.paymentMethods.retrieve).toHaveBeenCalledWith('pm_test_google_pay_token');
      expect(stripeMock.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method: 'pm_test_google_pay_token',
          confirm: true,
          automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        }),
      );
      expect(result.providerPaymentId).toBe('pi_google1');
      expect(result.status).toBe('succeeded');
    });

    it('handles a tok_ prefixed token via paymentMethods.create', async () => {
      const { gateway, stripeMock } = makeGateway();

      stripeMock.paymentMethods.create.mockResolvedValue({
        id: 'pm_from_token',
        type: 'card',
      });

      stripeMock.paymentIntents.create.mockResolvedValue({
        id: 'pi_2',
        status: 'requires_action',
        metadata: {},
      });

      const result = await gateway.processGooglePay({
        ...googlePayRequest,
        tokenData: {
          paymentMethodData: {
            tokenizationData: { type: 'PAYMENT_GATEWAY', token: 'tok_test_visa' },
          },
        },
      });

      expect(stripeMock.paymentMethods.create).toHaveBeenCalledWith({
        type: 'card',
        card: { token: 'tok_test_visa' },
      });
      expect(result.status).toBe('processing');
    });

    it('returns failed when token cannot be extracted', async () => {
      const { gateway } = makeGateway();

      const result = await gateway.processGooglePay({
        ...googlePayRequest,
        tokenData: { invalid: 'structure' },
      });

      expect(result.status).toBe('failed');
      expect(result.failureReason).toContain('Invalid Google Pay token');
    });

    it('returns processing status when PI requires_action', async () => {
      const { gateway, stripeMock } = makeGateway();

      stripeMock.paymentMethods.retrieve.mockResolvedValue({
        id: 'pm_3d_secure',
        type: 'card',
      });

      stripeMock.paymentIntents.create.mockResolvedValue({
        id: 'pi_3ds',
        status: 'requires_action',
        metadata: {},
      });

      const result = await gateway.processGooglePay(googlePayRequest);

      expect(result.status).toBe('processing');
      expect(result.providerPaymentId).toBe('pi_3ds');
    });

    it('returns failed status when PI is canceled', async () => {
      const { gateway, stripeMock } = makeGateway();

      stripeMock.paymentMethods.retrieve.mockResolvedValue({
        id: 'pm_canceled',
        type: 'card',
      });

      stripeMock.paymentIntents.create.mockResolvedValue({
        id: 'pi_canceled',
        status: 'canceled',
        metadata: {},
      });

      const result = await gateway.processGooglePay(googlePayRequest);

      expect(result.status).toBe('failed');
    });

    it('propagates Stripe errors for the service layer to handle', async () => {
      const { gateway, stripeMock } = makeGateway();

      stripeMock.paymentMethods.retrieve.mockRejectedValue(new Error('No such PaymentMethod'));

      await expect(gateway.processGooglePay(googlePayRequest)).rejects.toThrow('No such PaymentMethod');
    });
  });

  /* ---------------------------------------------------------------- */
  /* verifyPayment                                                     */
  /* ---------------------------------------------------------------- */

  describe('verifyPayment', () => {
    it('returns succeeded for a completed PaymentIntent', async () => {
      const { gateway, stripeMock } = makeGateway();

      stripeMock.paymentIntents.retrieve.mockResolvedValue({
        id: 'pi_abc',
        status: 'succeeded',
      });

      const result = await gateway.verifyPayment({ providerPaymentId: 'pi_abc' });

      expect(result.status).toBe('succeeded');
    });

    it('returns processing for a requires_action PaymentIntent', async () => {
      const { gateway, stripeMock } = makeGateway();

      stripeMock.paymentIntents.retrieve.mockResolvedValue({
        id: 'pi_abc',
        status: 'requires_action',
      });

      const result = await gateway.verifyPayment({ providerPaymentId: 'pi_abc' });

      expect(result.status).toBe('processing');
    });

    it('returns failed for a canceled PaymentIntent', async () => {
      const { gateway, stripeMock } = makeGateway();

      stripeMock.paymentIntents.retrieve.mockResolvedValue({
        id: 'pi_abc',
        status: 'canceled',
      });

      const result = await gateway.verifyPayment({ providerPaymentId: 'pi_abc' });

      expect(result.status).toBe('failed');
    });
  });

  /* ---------------------------------------------------------------- */
  /* refundPayment                                                     */
  /* ---------------------------------------------------------------- */

  describe('refundPayment', () => {
    it('creates a full refund', async () => {
      const { gateway, stripeMock } = makeGateway();

      stripeMock.refunds.create.mockResolvedValue({ id: 're_123' });

      const result = await gateway.refundPayment({ providerPaymentId: 'pi_abc' });

      expect(stripeMock.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_abc',
      });
      expect(result.refunded).toBe(true);
      expect(result.refundId).toBe('re_123');
    });

    it('creates a partial refund when amount is specified', async () => {
      const { gateway, stripeMock } = makeGateway();

      stripeMock.refunds.create.mockResolvedValue({ id: 're_partial' });

      const result = await gateway.refundPayment({ providerPaymentId: 'pi_abc', amount: 500 });

      expect(stripeMock.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_abc',
        amount: 500,
      });
      expect(result.refunded).toBe(true);
    });

    it('returns refunded=false when Stripe rejects the refund', async () => {
      const { gateway, stripeMock } = makeGateway();

      stripeMock.refunds.create.mockRejectedValue(new Error('Charge already refunded'));

      const result = await gateway.refundPayment({ providerPaymentId: 'pi_abc' });

      expect(result.refunded).toBe(false);
    });
  });

  /* ---------------------------------------------------------------- */
  /* verifyWebhook                                                     */
  /* ---------------------------------------------------------------- */

  describe('verifyWebhook', () => {
    const makeStripeEvent = (type: string, object: Record<string, unknown>) => ({
      type,
      data: { object },
      id: 'evt_test',
    });

    it('verifies a valid payment_intent.succeeded webhook', async () => {
      const { gateway, stripeMock } = makeGateway();

      const event = makeStripeEvent('payment_intent.succeeded', {
        id: 'pi_ok',
        metadata: { userId: 'user-1', plan: 'PREMIUM' },
      });
      stripeMock.webhooks.constructEvent.mockReturnValue(event);

      const result = await gateway.verifyWebhook({
        headers: { 'stripe-signature': 't=123,v1=abc' },
        body: Buffer.from('raw body'),
      });

      expect(result.valid).toBe(true);
      expect(result.event).toEqual({
        type: 'payment_intent.succeeded',
        eventId: 'evt_test',
        providerPaymentId: 'pi_ok',
        status: 'succeeded',
        metadata: { userId: 'user-1', plan: 'PREMIUM' },
      });
    });

    it('verifies a payment_intent.payment_failed webhook', async () => {
      const { gateway, stripeMock } = makeGateway();

      const event = makeStripeEvent('payment_intent.payment_failed', {
        id: 'pi_fail',
        last_payment_error: { message: 'Card declined' },
        metadata: {},
      });
      stripeMock.webhooks.constructEvent.mockReturnValue(event);

      const result = await gateway.verifyWebhook({
        headers: { 'stripe-signature': 'sig' },
        body: Buffer.from('body'),
      });

      expect(result.valid).toBe(true);
      expect(result.event?.status).toBe('failed');
    });

    it('verifies a charge.refunded webhook', async () => {
      const { gateway, stripeMock } = makeGateway();

      const event = makeStripeEvent('charge.refunded', {
        id: 'ch_refund',
        payment_intent: 'pi_refunded',
        metadata: {},
      });
      stripeMock.webhooks.constructEvent.mockReturnValue(event);

      const result = await gateway.verifyWebhook({
        headers: { 'stripe-signature': 'sig' },
        body: Buffer.from('body'),
      });

      expect(result.valid).toBe(true);
      expect(result.event?.status).toBe('refunded');
      expect(result.event?.providerPaymentId).toBe('pi_refunded');
    });

    it('rejects when stripe-signature header is missing', async () => {
      const { gateway } = makeGateway();

      const result = await gateway.verifyWebhook({
        headers: {},
        body: Buffer.from('body'),
      });

      expect(result.valid).toBe(false);
    });

    it('rejects when body is not a Buffer', async () => {
      const { gateway } = makeGateway();

      const result = await gateway.verifyWebhook({
        headers: { 'stripe-signature': 'sig' },
        body: { parsed: true },
      });

      expect(result.valid).toBe(false);
    });

    it('rejects when Stripe signature verification fails', async () => {
      const { gateway, stripeMock } = makeGateway();

      stripeMock.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature');
      });

      const result = await gateway.verifyWebhook({
        headers: { 'stripe-signature': 'bad_sig' },
        body: Buffer.from('body'),
      });

      expect(result.valid).toBe(false);
    });

    it('acknowledges unrecognized event types as valid (no-op)', async () => {
      const { gateway, stripeMock } = makeGateway();

      const event = makeStripeEvent('customer.created', { id: 'cus_123' });
      stripeMock.webhooks.constructEvent.mockReturnValue(event);

      const result = await gateway.verifyWebhook({
        headers: { 'stripe-signature': 'sig' },
        body: Buffer.from('body'),
      });

      expect(result.valid).toBe(true);
      expect(result.event).toBeUndefined(); // unhandled type → no event
    });

    it('handles payment_intent.processing webhook', async () => {
      const { gateway, stripeMock } = makeGateway();

      const event = makeStripeEvent('payment_intent.processing', {
        id: 'pi_proc',
        metadata: {},
      });
      stripeMock.webhooks.constructEvent.mockReturnValue(event);

      const result = await gateway.verifyWebhook({
        headers: { 'stripe-signature': 'sig' },
        body: Buffer.from('body'),
      });

      expect(result.valid).toBe(true);
      expect(result.event?.status).toBe('processing');
    });
  });
});
