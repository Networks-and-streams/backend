import { Injectable } from '@nestjs/common';
import { Payment } from '@/generated/prisma/client';
import { PaymentResponseDto } from './dto/payment-response.dto';

/**
 * Maps Payment records to API responses, explicitly excluding internal
 * fields such as `providerMetadata` (provider-specific data must never
 * leak to clients).
 */
@Injectable()
export class PaymentsMapper {
  toResponse(payment: Payment): PaymentResponseDto {
    return {
      id: payment.id,
      userId: payment.userId,
      subscriptionId: payment.subscriptionId,
      provider: payment.provider,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      plan: payment.plan,
      amount: payment.amount,
      currency: payment.currency,
      providerPaymentId: payment.providerPaymentId,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  toResponses(payments: Payment[]): PaymentResponseDto[] {
    return payments.map((payment) => this.toResponse(payment));
  }
}
