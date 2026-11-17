import { SubscriptionPlan } from '@/generated/prisma/client';

import { TestPaymentGateway } from './test.gateway';

/**
 * PAYMENTS_TEST_MODE gateway (expansion plan §5.7): payments must complete
 * locally and successfully so the whole purchase flow can be exercised on a
 * desktop install without any PSP credentials.
 */
describe('TestPaymentGateway', () => {
  const gateway = new TestPaymentGateway();

  const request = {
    paymentId: 'pay-1',
    userId: 'user-1',
    subscriptionId: 'sub-1',
    plan: SubscriptionPlan.PREMIUM,
    amount: 999,
    currency: 'USD',
    tokenData: { type: 'TEST', token: 'test-mode' },
  };

  it('completes a payment submission successfully without inspecting the token', async () => {
    const result = await gateway.processGooglePay(request);

    expect(result.status).toBe('succeeded');
    expect(result.providerPaymentId).toBe('test_pay-1');
    expect(result.metadata).toMatchObject({ testMode: true, amount: 999, currency: 'USD' });
    expect(result.failureReason).toBeUndefined();
  });

  it('verifies any provider reference as succeeded (nothing can fail in test mode)', async () => {
    const result = await gateway.verifyPayment({ providerPaymentId: 'test_pay-1' });

    expect(result.status).toBe('succeeded');
    expect(result.metadata).toMatchObject({ testMode: true, providerPaymentId: 'test_pay-1' });
  });

  it('creates a provider order reference for the create step', async () => {
    const result = await gateway.createPayment({
      userId: 'user-1',
      plan: SubscriptionPlan.PREMIUM,
      amount: 999,
      currency: 'USD',
    });

    expect(result.providerPaymentId).toBe('test_order_user-1_PREMIUM');
    expect(result.metadata).toMatchObject({ testMode: true });
  });

  it('grants refunds locally', async () => {
    const result = await gateway.refundPayment({ providerPaymentId: 'test_pay-1' });

    expect(result).toEqual({ refunded: true, refundId: 'test_refund_test_pay-1' });
  });

  it('rejects every webhook — test mode has no PSP, so no delivery is authentic', async () => {
    const result = await gateway.verifyWebhook({ headers: {}, body: {} });

    expect(result.valid).toBe(false);
    expect(result.event).toBeUndefined();
  });
});
