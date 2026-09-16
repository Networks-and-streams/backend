import { ApiProperty } from '@nestjs/swagger';

export class SessionResponseDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    description: 'Unique identifier of the session (UUID)',
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    example: '192.168.1.1',
    description: 'IP address of the client',
    required: false,
  })
  ip?: string;

  @ApiProperty({
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
    description: 'User-Agent string of the client browser',
    required: false,
  })
  userAgent?: string;

  @ApiProperty({
    example: '2026-07-15T10:00:00.000Z',
    description: 'Timestamp when the session expires',
    format: 'date-time',
  })
  expiresAt!: Date;

  @ApiProperty({
    example: '2026-07-08T13:40:00.000Z',
    description: 'Timestamp when the session was created',
    format: 'date-time',
  })
  createdAt!: Date;
}
