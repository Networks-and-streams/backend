import { ApiProperty } from '@nestjs/swagger';

/**
 * Client-facing payment configuration (GET /payments/config).
 *
 * Tells the UI how payments behave in *this* deployment so it can offer the
 * matching affordance (the "Test purchase" button instead of Google Pay).
 * Exposes a single capability flag — never secrets or provider internals.
 */
export class PaymentConfigResponseDto {
  @ApiProperty({
    description:
      'True when the backend runs in PAYMENTS_TEST_MODE: payments are completed locally by the ' +
      'test gateway without contacting a real payment service provider (manual testing only).',
    example: true,
  })
  testMode!: boolean;
}
