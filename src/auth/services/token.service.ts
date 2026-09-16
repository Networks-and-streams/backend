import { Injectable, Inject } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';

import type { StringValue } from 'ms';

import { JwtUser, RefreshJwtPayload } from '@/common/types/jwt-payload.type';
import jwtConfig from '@/config/loaders/jwt.config';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY) private readonly config: ConfigType<typeof jwtConfig>,
  ) {}

  async accessToken(id: string, email: string, sid: string) {
    const payload: JwtUser = { id, email, sid };

    return this.jwtService.signAsync(payload, {
      secret: this.config.secret,
      expiresIn: this.config.accessTokenTtl as StringValue,
    });
  }

  async refreshToken(id: string, sid: string) {
    const payload: RefreshJwtPayload = { id, sid, jti: randomUUID() };

    return this.jwtService.signAsync(payload, {
      secret: this.config.refreshSecret,
      expiresIn: this.config.refreshTokenTtl as StringValue,
    });
  }

  async generate(id: string, email: string, sid: string) {
    const [access, refresh] = await Promise.all([
      this.accessToken(id, email, sid), //
      this.refreshToken(id, sid),
    ]);

    return {
      accessToken: access,
      refreshToken: refresh,
    };
  }

  async verifyAccessToken(token: string): Promise<JwtUser> {
    return this.jwtService.verifyAsync<JwtUser>(token, {
      secret: this.config.secret,
    });
  }
}
