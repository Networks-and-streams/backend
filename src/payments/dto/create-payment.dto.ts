import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';

import { PaymentMethod, SubscriptionPlan } from '@/generated/prisma/client';

export class CreatePaymentDto {
  @ApiProperty({
    enum: SubscriptionPlan,
    example: SubscriptionPlan.PREMIUM,
    description: 'The plan the user intends to pay for. Amount/currency are never accepted from the client.',
  })
  @IsEnum(SubscriptionPlan)
  @IsNotEmpty()
  plan!: SubscriptionPlan;

  @ApiProperty({
    enum: PaymentMethod,
    example: PaymentMethod.GOOGLE_PAY,
    description: 'How the user intends to pay.',
  })
  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  paymentMethod!: PaymentMethod;
}
