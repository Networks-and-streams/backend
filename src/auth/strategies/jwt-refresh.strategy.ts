import { Injectable, Logger, UnauthorizedException, Inject } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RefreshJwtPayload } from '@/common/types/jwt-payload.type';
import { AuthService } from '../auth.service';
import jwtConfig from '@/config/loaders/jwt.config';

import type { Request } from 'express';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  private readonly logger = new Logger(JwtRefreshStrategy.name);
  constructor(
    private readonly authService: AuthService,
    @Inject(jwtConfig.KEY) private readonly config: ConfigType<typeof jwtConfig>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          return (request?.cookies?.['refreshToken'] as string) ?? null;
        },
      ]),

      ignoreExpiration: false,
      secretOrKey: config.refreshSecret,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: RefreshJwtPayload) {
    const user = await this.authService.validateUser(payload.id);
    if (!user) {
      this.logger.warn(`Refresh token validation failed for user ${payload.id}`);
      throw new UnauthorizedException();
    }
    return payload;
  }
}
