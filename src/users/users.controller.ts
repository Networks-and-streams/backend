import { Body, Controller, Delete, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Lang } from '@/common/decorators/language.decorator';
import { Public } from '@/common/decorators/public.decorator';
import type { Language } from '@/common/types/language';
import { AccountEmailService, type EmailConfirmation } from './account-email.service';
import { ChangeEmailDto } from './dto/change-email.dto';
import { ConfirmEmailDto } from './dto/confirm-email.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import type { JwtUser } from '@/common/types/jwt-payload.type';
import { UsersService } from './users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly accountEmail: AccountEmailService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: "Current user's profile" })
  @ApiOkResponse({ type: ProfileResponseDto })
  getProfile(@CurrentUser('id') userId: string): Promise<ProfileResponseDto> {
    return this.usersService.getProfile(userId);
  }

  @Patch('me/password')
  @HttpCode(204)
  // Tighter than the global limit: this endpoint verifies the current password.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Change (or, for Google-only accounts, set) the password',
    description: 'Signs out every other device; the current session stays signed in.',
  })
  @ApiNoContentResponse({ description: 'Password changed' })
  @ApiBadRequestResponse({ description: 'Current password is wrong or the new password is invalid' })
  async changePassword(@CurrentUser() user: JwtUser, @Body() dto: ChangePasswordDto): Promise<void> {
    await this.usersService.changePassword(user.id, user.sid, dto);
  }

  @Post('me/email/verification')
  @HttpCode(204)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Send (again) the link that verifies the current email' })
  async sendVerification(@CurrentUser('id') userId: string, @Lang() lang: Language): Promise<void> {
    await this.accountEmail.sendVerification(userId, lang);
  }

  @Patch('me/email')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Request an email change',
    description:
      'Checks the password and sends a confirmation link to the new address; nothing changes until it is opened.',
  })
  async requestEmailChange(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangeEmailDto,
    @Lang() lang: Language,
  ): Promise<void> {
    await this.accountEmail.requestChange(userId, dto, lang);
  }

  @Public()
  @Post('email/confirm')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Apply a link from an email (verification or email change)' })
  confirmEmail(@Body() dto: ConfirmEmailDto, @Lang() lang: Language): Promise<EmailConfirmation> {
    return this.accountEmail.confirm(dto.token, lang);
  }

  @Delete('me')
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Permanently delete the account',
    description: 'Payments are kept anonymized for accounting; everything else is deleted.',
  })
  async deleteAccount(@CurrentUser('id') userId: string, @Body() dto: DeleteAccountDto): Promise<void> {
    await this.usersService.deleteAccount(userId, dto);
  }
}
