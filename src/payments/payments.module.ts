import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SubscriptionsModule } from '@/subscriptions/subscriptions.module';
import paymentConfig from '@/config/loaders/payment.config';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsMapper } from './payments.mapper';
import { PAYMENT_GATEWAY } from './payment.gateway';
import { StubPaymentGateway } from './providers/stub.gateway';

@Module({
  imports: [SubscriptionsModule, ConfigModule.forFeature(paymentConfig)],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentsMapper,
    // The payment domain depends on the PaymentGateway abstraction.
    // Replace the concrete implementation here without touching the domain.
    { provide: PAYMENT_GATEWAY, useClass: StubPaymentGateway },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
