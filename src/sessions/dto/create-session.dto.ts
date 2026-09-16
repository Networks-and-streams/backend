import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsDate, IsOptional } from 'class-validator';

export class CreateSessionDto {
  @ApiPropertyOptional({
    description: 'Hashed refresh token used to identify the session',
    example: 'a1b2c3d4e5f6...',
  })
  @IsString()
  @IsOptional()
  tokenHash?: string;

  @ApiProperty({
    description: 'Date and time when the session expires',
    example: '2026-08-15T10:00:00.000Z',
  })
  @IsDate()
  @IsNotEmpty()
  expiresAt!: Date;

  @ApiPropertyOptional({
    description: 'User-Agent string from the client browser or device',
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  })
  @IsString()
  @IsOptional()
  userAgent?: string;

  @ApiPropertyOptional({
    description: 'IP address of the client',
    example: '192.168.1.1',
  })
  @IsString()
  @IsOptional()
  ip?: string;
}
