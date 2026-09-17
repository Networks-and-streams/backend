import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionPlan, SubscriptionStatus } from '@/generated/prisma/client';

export class SubscriptionResponseDto {
  @ApiProperty({ description: 'Subscription ID', example: 'b1a2c3d4-e5f6-7890-abcd-ef1234567890' })
  id!: string;

  @ApiProperty({ enum: SubscriptionStatus, example: SubscriptionStatus.INACTIVE })
  status!: SubscriptionStatus;

  @ApiProperty({ enum: SubscriptionPlan, example: SubscriptionPlan.FREE })
  plan!: SubscriptionPlan;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'When the subscription became active',
  })
  startedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'When the subscription access ends' })
  expiresAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Last update timestamp' })
  updatedAt!: Date;
}
