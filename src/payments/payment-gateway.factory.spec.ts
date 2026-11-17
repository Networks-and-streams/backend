import type { ConfigType } from '@nestjs/config';

import paymentConfig from '@/config/loaders/payment.config';

import { createPaymentGateway } from './payment-gateway.factory';
import { StripeGateway } from './providers/stripe/stripe.gateway';
import { TestPaymentGateway } from './providers/test/test.gateway';

type PaymentConfig = ConfigType<typeof paymentConfig>;

const baseConfig: PaymentConfig = {
  provider: 'stripe',
  defaultCurrency: 'USD',
  webhookSecret: 'test-webhook-secret-0123456789',
  googlePayMerchantId: 'merchant-1',
  stripeSecretKey: 'sk_test_dummy',
  stripeWebhookSecret: 'whsec_dummy',
  stripeApiVersion: undefined,
  testMode: false,
};

describe('createPaymentGateway', () => {
  it('returns StripeGateway for the stripe provider in normal mode', () => {
    const gateway = createPaymentGateway(baseConfig);

    expect(gateway).toBeInstanceOf(StripeGateway);
  });

  it('returns the local TestPaymentGateway when PAYMENTS_TEST_MODE is on', () => {
    const gateway = createPaymentGateway({ ...baseConfig, testMode: true });

    expect(gateway).toBeInstanceOf(TestPaymentGateway);
  });

  it('lets test mode win over the configured provider (no PSP is ever contacted)', () => {
    const gateway = createPaymentGateway({ ...baseConfig, provider: 'liqpay', testMode: true });

    expect(gateway).toBeInstanceOf(TestPaymentGateway);
  });

  it('throws for a provider that has no implementation yet', () => {
    expect(() => createPaymentGateway({ ...baseConfig, provider: 'liqpay' })).toThrow(/not implemented yet/);
  });
});
