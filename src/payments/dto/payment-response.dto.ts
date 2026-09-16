import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod, PaymentProvider, PaymentStatus, SubscriptionPlan } from '@/generated/prisma/client';

export class PaymentResponseDto {
  @ApiProperty({ description: 'Internal payment ID', example: 'b1a2c3d4-e5f6-7890-abcd-ef1234567890' })
  id!: string;

  @ApiProperty({ description: 'Ownership user ID' })
  userId!: string;

  @ApiProperty({ description: 'Related subscription ID, if any', nullable: true })
  subscriptionId!: string | null;

  @ApiProperty({ enum: PaymentProvider })
  provider!: PaymentProvider;

  @ApiProperty({ enum: PaymentMethod })
  paymentMethod!: PaymentMethod;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;

  @ApiProperty({ enum: SubscriptionPlan })
  plan!: SubscriptionPlan;

  /** Amount in smallest currency unit (e.g. cents). Never client-provided. */
  @ApiProperty({ description: 'Amount in smallest currency unit (cents)' })
  amount!: number;

  @ApiProperty({ description: 'ISO-4217 currency code' })
  currency!: string;

  @ApiProperty({
    description: 'Provider payment reference (if the PSP returned one)',
    nullable: true,
  })
  providerPaymentId!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
