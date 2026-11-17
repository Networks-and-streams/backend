import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SubscriptionsModule } from '@/subscriptions/subscriptions.module';
import paymentConfig from '@/config/loaders/payment.config';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsMapper } from './payments.mapper';
import { PAYMENT_GATEWAY } from './payment.gateway';
import { createPaymentGateway } from './payment-gateway.factory';

@Module({
  imports: [SubscriptionsModule, ConfigModule.forFeature(paymentConfig)],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentsMapper,
    // The payment domain depends on the PaymentGateway abstraction — the
    // concrete provider (Stripe, or the local test gateway when
    // PAYMENTS_TEST_MODE is on) is chosen in payment-gateway.factory.ts.
    {
      provide: PAYMENT_GATEWAY,
      inject: [paymentConfig.KEY],
      useFactory: createPaymentGateway,
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
