import { ApiProperty } from '@nestjs/swagger';

export class AuthTokensResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token for authorizing subsequent requests',
  })
  accessToken!: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }
}
