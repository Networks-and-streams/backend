import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class AuthBaseDto {
  @ApiProperty({
    example: 'rYK9o@example.com',
    description: "User's email address",
    format: 'email',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'password1234',
    description: "User's password (minimum 6 characters)",
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password!: string;
}
