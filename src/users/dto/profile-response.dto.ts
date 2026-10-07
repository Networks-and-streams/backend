import { ApiProperty } from '@nestjs/swagger';
import { OAuthProvider } from '@/generated/prisma/client';

export class ProfileResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ description: 'The user proved they own the email (free daily runs require it)' })
  emailVerified!: boolean;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ description: 'False for accounts created with Google that never set a password' })
  hasPassword!: boolean;
  @ApiProperty({ enum: OAuthProvider, isArray: true, description: 'Linked sign-in providers' })
  providers!: OAuthProvider[];
}
