import { Injectable, Inject } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import ms from 'ms';
import type { StringValue } from 'ms';

import appConfig from '@/config/loaders/app.config';
import jwtConfig from '@/config/loaders/jwt.config';

@Injectable()
export class CookieService {
  constructor(
    @Inject(appConfig.KEY)
    private readonly app: ConfigType<typeof appConfig>,

    @Inject(jwtConfig.KEY)
    private readonly jwt: ConfigType<typeof jwtConfig>,
  ) {}

  private baseOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.app.cookieSecure,
      sameSite: this.app.cookieSameSite,
      // Always include `domain` (even when empty). An empty COOKIE_DOMAIN
      // produces a host-only cookie (no Domain attribute), which is required
      // when the frontend and API share one origin behind a local tunnel
      // (ngrok): a Domain=localhost cookie would be rejected for any other
      // host — both by Express 5's own domain validation and by the browser.
      domain: this.app.cookieDomain || undefined,
    };
  }

  setRefreshToken(res: Response, token: string) {
    const maxAge = ms(this.jwt.refreshTokenTtl as StringValue);

    res.cookie('refreshToken', token, { ...this.baseOptions(), maxAge });
  }

  clearRefreshToken(res: Response) {
    res.clearCookie('refreshToken', this.baseOptions());
  }
}
