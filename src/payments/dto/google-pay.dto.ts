import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject } from 'class-validator';

/**
 * Google Pay payment-method payload.
 *
 * This DTO lives at the boundary between the payment domain and the
 * Google Pay payment method. The core payment domain only sees the raw
 * `tokenData` object — it never interprets Google Pay fields itself; the
 * provider adapter (e.g. StripeGateway) does.
 */
export class GooglePayDto {
  @ApiProperty({
    description:
      'Google Pay tokenization data as returned by the Google Pay API. For the Stripe ' +
      'gateway (tokenization type PAYMENT_GATEWAY) this is `{ type, token }` where `token` ' +
      'is a Stripe token (tok_...) or PaymentMethod (pm_...).',
    example: {
      type: 'PAYMENT_GATEWAY',
      token: 'tok_1ABCdef...',
    },
  })
  @IsObject()
  @IsNotEmpty()
  tokenData!: Record<string, unknown>;
}
