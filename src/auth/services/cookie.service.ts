import { Injectable, Inject } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Response } from 'express';
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

  setRefreshToken(res: Response, token: string) {
    const maxAge = ms(this.jwt.refreshTokenTtl as StringValue);

    res.cookie('refreshToken', token, {
      httpOnly: true,
      domain: this.app.cookieDomain,
      maxAge,
      secure: this.app.cookieSecure,
      sameSite: this.app.cookieSameSite,
    });
  }

  clearRefreshToken(res: Response) {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      domain: this.app.cookieDomain,
      secure: this.app.cookieSecure,
      sameSite: this.app.cookieSameSite,
    });
  }
}
