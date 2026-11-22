import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiPropertyOptional({
    description: 'Current password. Required when the account already has one (not for Google-only accounts).',
  })
  @IsOptional()
  @IsString()
  currentPassword?: string;

  // bcrypt only uses the first 72 bytes, so longer input would silently be ignored.
  @ApiProperty({ minLength: 6, maxLength: 72, description: 'New password (6–72 characters)' })
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  newPassword!: string;
}
