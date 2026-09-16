import { Controller, Get, Inject, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiFoundResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { OauthService } from './oauth.service';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import { NormalizedOAuthProfile } from './interfaces/normalized-oauth-profile.interface';
import { Public } from '@/common/decorators/public.decorator';
import { CookieService } from '@/auth/services/cookie.service';
import appConfig from '@/config/loaders/app.config';
import type { ConfigType } from '@nestjs/config';

@ApiTags('OAuth')
@Controller('oauth')
export class OauthController {
  constructor(
    private readonly oauthService: OauthService,
    private readonly cookieService: CookieService,

    @Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>,
  ) {}

  @Public()
  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({
    summary: 'Initiate Google OAuth login',
    description:
      'Starts the Google OAuth 2.0 authentication flow by redirecting the user ' +
      "to Google's consent screen. This is a public endpoint that does not require " +
      'a JWT access token. After the user authorizes, Google redirects to the callback endpoint.',
  })
  @ApiFoundResponse({ description: 'Redirects to Google for authentication' })
  google() {}

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({
    summary: 'Google OAuth callback',
    description:
      'Handles the callback from Google after the user completes the OAuth flow. ' +
      'Extracts the user profile, creates or retrieves the user account, generates ' +
      'authentication tokens, and redirects the user to the frontend application. ' +
      'The refresh token is set as an HttpOnly cookie.',
  })
  @ApiFoundResponse({ description: 'Redirects to the frontend application after successful authentication' })
  @ApiUnauthorizedResponse({ description: 'OAuth authentication failed or user denied access' })
  async callback(@Req() req: Request, @Res() res: Response) {
    const profile = req.user as NormalizedOAuthProfile;
    const meta = { ip: req.ip, userAgent: req.headers['user-agent'] };

    const { refreshToken } = await this.oauthService.login(profile, meta);

    this.cookieService.setRefreshToken(res, refreshToken);

    return res.redirect(`${this.app.frontendUrl}/auth/callback`);
  }
}
