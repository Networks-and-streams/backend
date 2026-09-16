import { OAuthProvider } from '@/generated/prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class CreateOAuthAccountDto {
  @ApiProperty({
    example: 'rYK9o@example.com',
    description: 'Email address associated with the OAuth account',
    format: 'email',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'google-oauth-id-123',
    description: 'Unique account identifier provided by the OAuth provider',
  })
  @IsString()
  @IsNotEmpty()
  providerAccountId!: string;

  @ApiProperty({
    enum: OAuthProvider,
    example: OAuthProvider.GOOGLE,
    description: 'OAuth provider (e.g. GOOGLE, GITHUB)',
  })
  @IsEnum(OAuthProvider)
  provider!: OAuthProvider;
}
