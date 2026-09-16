import { BadRequestException, Injectable, Logger, UnauthorizedException, Inject } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import * as bcrypt from 'bcrypt';
import * as crypto from 'node:crypto';
import ms from 'ms';

import type { StringValue } from 'ms';

import { JwtUser, RefreshJwtPayload } from '@/common/types/jwt-payload.type';
import jwtConfig from '@/config/loaders/jwt.config';

import { UsersService } from '@/users/users.service';
import { SessionsService } from '@/sessions/sessions.service';
import { TokenService } from './services/token.service';

import { RegisterDto } from './dto/register.dto';

interface SessionMetadata {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly tokenService: TokenService,
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService,

    @Inject(jwtConfig.KEY) private readonly jwt: ConfigType<typeof jwtConfig>,
  ) {}

  async validateUser(userId: string): Promise<{ id: string; email: string } | null> {
    const user = await this.usersService.findUserById(userId);
    if (!user) return null;
    return { id: user.id, email: user.email };
  }

  async validateCredentials(email: string, password: string): Promise<{ id: string; email: string } | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user?.password) return null;

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return null;

    return { id: user.id, email: user.email };
  }

  async login(user: JwtUser, meta: SessionMetadata) {
    this.logger.log(`User ${user.id} logged in`);
    return this.auth(user.id, user.email, meta);
  }

  async refresh(payload: RefreshJwtPayload, oldRefreshToken: string, meta: SessionMetadata) {
    const session = await this.sessionsService.findByIdOrThrow(payload.sid);

    const oldHash = this.hashToken(oldRefreshToken);

    if ((session.tokenHash ?? '') !== oldHash || new Date() > session.expiresAt) {
      this.logger.warn(`Refresh attempt with expired or invalid session ${payload.sid} for user ${payload.id}`);
      throw new UnauthorizedException('Session expired or invalid. Please login again.');
    }

    const refreshTokenTTLMs = this.parseTTL(this.jwt.refreshTokenTtl as StringValue);
    const expiresAt = new Date(Date.now() + refreshTokenTTLMs);
    const newRefreshToken = await this.tokenService.refreshToken(payload.id, payload.sid);
    const newHash = this.hashToken(newRefreshToken);

    const count = await this.sessionsService.rotateToken(
      payload.sid,
      oldHash,
      newHash,
      expiresAt,
      meta.ip,
      meta.userAgent,
    );

    if (count === 0) {
      this.logger.warn(`Token rotation failed for session ${payload.sid} (user ${payload.id})`);
      throw new UnauthorizedException('Session expired or invalid. Please login again.');
    }

    this.logger.log(`User ${payload.id} refreshed session ${payload.sid}`);

    const user = await this.usersService.findByIdOrThrow(payload.id);
    const accessToken = await this.tokenService.accessToken(payload.id, user.email, payload.sid);

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken?: string) {
    if (refreshToken) {
      const hash = this.hashToken(refreshToken);
      await this.sessionsService.removeByHash(hash);
    }
    this.logger.log('User logged out');
  }

  async register(dto: RegisterDto, meta: SessionMetadata) {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      this.logger.warn(`Registration attempt with existing email: ${dto.email}`);
      throw new BadRequestException('User with this email already exists. Please login instead.');
    }

    const user = await this.usersService.create(dto.email, dto.password);
    this.logger.log(`User ${user.id} registered with email ${dto.email}`);

    return this.auth(user.id, user.email, meta);
  }

  async logoutAllDevices(userId: string) {
    await this.sessionsService.removeAllUserSessions(userId);
    this.logger.log(`User ${userId} logged out from all devices`);
  }

  private async auth(id: string, email: string, meta: SessionMetadata) {
    const refreshTokenTTLMs = this.parseTTL(this.jwt.refreshTokenTtl as StringValue);
    const expiresAt = new Date(Date.now() + refreshTokenTTLMs);

    const session = await this.sessionsService.create(id, {
      expiresAt,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    const { accessToken, refreshToken } = await this.tokenService.generate(id, email, session.id);

    const tokenHash = this.hashToken(refreshToken);

    await this.sessionsService.update(session.id, { tokenHash });

    return { accessToken, refreshToken };
  }

  private parseTTL(ttl: StringValue): number {
    if (typeof ttl === 'number') return ttl;
    return ms(ttl);
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
