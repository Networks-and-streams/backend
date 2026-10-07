import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class ConfirmEmailDto {
  @ApiProperty({ description: 'Token from the email link' })
  @IsString()
  @Length(20, 200)
  token!: string;
}
