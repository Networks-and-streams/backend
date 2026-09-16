import { ApiProperty } from '@nestjs/swagger';
import { JwtUser } from '@/common/types/jwt-payload.type';

export class JwtUserDto implements JwtUser {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Unique identifier of the user (UUID)',
  })
  id!: string;

  @ApiProperty({
    example: 'rYK9o@example.com',
    description: 'Email address of the user',
  })
  email!: string;

  @ApiProperty({
    example: 'abc123',
    description: 'Session identifier',
  })
  sid!: string;
}
