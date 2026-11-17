import { Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import paymentConfig from '@/config/loaders/payment.config';

import type { PaymentGateway } from './payment.gateway';
import { StripeGateway } from './providers/stripe/stripe.gateway';
import { TestPaymentGateway } from './providers/test/test.gateway';

/**
 * Selects the concrete `PaymentGateway` for this deployment.
 *
 * - `PAYMENTS_TEST_MODE=true` → local {@link TestPaymentGateway}: payments
 *   complete immediately without contacting any PSP (manual QA of the
 *   desktop build — expansion plan §5.7).
 * - otherwise → the configured provider (Stripe today).
 *
 * Kept as a standalone function so the selection logic is unit-testable
 * without booting the whole `PaymentsModule`.
 */
export function createPaymentGateway(payment: ConfigType<typeof paymentConfig>): PaymentGateway {
  if (payment.testMode) {
    new Logger('Payments').warn(
      'PAYMENTS_TEST_MODE is enabled — payments complete locally without contacting a payment provider. ' +
        'Manual testing only: disable the flag (or configure real Stripe keys) for real payments.',
    );
    return new TestPaymentGateway();
  }

  if (payment.provider === 'stripe') {
    return new StripeGateway(payment.stripeSecretKey, payment.stripeWebhookSecret, payment.stripeApiVersion);
  }

  // TODO: add LiqPayGateway / WayForPayGateway implementations.
  throw new Error(
    `Payment provider "${payment.provider}" is not implemented yet. ` + 'Only "stripe" is currently available.',
  );
}
