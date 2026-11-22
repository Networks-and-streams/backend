import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class DeleteAccountDto {
  @ApiPropertyOptional({ description: 'Current password (accounts that have one)' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'The account email typed out (Google-only accounts)' })
  @IsOptional()
  @IsString()
  confirmEmail?: string;
}
