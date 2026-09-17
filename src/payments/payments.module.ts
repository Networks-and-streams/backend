import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';

import { SubscriptionsModule } from '@/subscriptions/subscriptions.module';
import paymentConfig from '@/config/loaders/payment.config';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsMapper } from './payments.mapper';
import { PAYMENT_GATEWAY } from './payment.gateway';
import { StripeGateway } from './providers/stripe/stripe.gateway';

@Module({
  imports: [SubscriptionsModule, ConfigModule.forFeature(paymentConfig)],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentsMapper,
    // The payment domain depends on the PaymentGateway abstraction.
    // Stripe is the active provider in TEST mode. Replace the concrete
    // implementation here to switch providers without touching the domain.
    {
      provide: PAYMENT_GATEWAY,
      inject: [paymentConfig.KEY],
      useFactory: (payment: ConfigType<typeof paymentConfig>) => {
        if (payment.provider === 'stripe') {
          return new StripeGateway(payment.stripeSecretKey, payment.stripeWebhookSecret, payment.stripeApiVersion);
        }
        // TODO: add LiqPayGateway / WayForPayGateway implementations.
        throw new Error(
          `Payment provider "${payment.provider}" is not implemented yet. ` + 'Only "stripe" is currently available.',
        );
      },
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
