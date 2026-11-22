import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class ChangeEmailDto {
  @ApiProperty({ format: 'email', description: 'New address; it must be confirmed from a link sent to it' })
  @IsEmail()
  newEmail!: string;

  @ApiProperty({ description: 'Current password (confirms it is really the account owner)' })
  @IsString()
  password!: string;
}
