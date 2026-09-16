import { OAuthProvider } from '@/generated/prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class OAuthAccountResponseDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Unique identifier of the OAuth account (UUID)',
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    enum: OAuthProvider,
    example: OAuthProvider.GOOGLE,
    description: 'OAuth provider (e.g. GOOGLE, GITHUB)',
  })
  provider!: OAuthProvider;

  @ApiProperty({
    example: 'google-oauth-id-123',
    description: 'Unique account identifier provided by the OAuth provider',
  })
  providerAccountId!: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'UUID of the user this OAuth account is linked to',
    format: 'uuid',
  })
  userId!: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Timestamp when the OAuth account was created',
    format: 'date-time',
  })
  createdAt!: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Timestamp when the OAuth account was last updated',
    format: 'date-time',
  })
  updatedAt!: Date;
}
