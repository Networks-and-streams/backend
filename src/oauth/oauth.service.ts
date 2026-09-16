import { Injectable, Logger } from '@nestjs/common';
import { OAuthProvider } from '@/generated/prisma/client';

import { PrismaService } from '@/core/prisma';
import { UsersService } from '@/users/users.service';
import { AuthService } from '@/auth/auth.service';

import { NormalizedOAuthProfile } from './interfaces/normalized-oauth-profile.interface';

interface SessionMetadata {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class OauthService {
  private readonly logger = new Logger(OauthService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  async login(profile: NormalizedOAuthProfile, meta: SessionMetadata) {
    const existingAccount = await this.findOAuthAccount(profile.provider, profile.providerAccountId);

    if (existingAccount) {
      const user = await this.usersService.findByIdOrThrow(existingAccount.userId);
      this.logger.log(`User ${user.id} logged in via ${profile.provider} (existing account)`);
      return this.authService.login({ id: existingAccount.userId, email: user.email, sid: '' }, meta);
    }

    const existingUser = await this.usersService.findByEmail(profile.email);

    const user = existingUser ?? (await this.createOAuthUser(profile));

    await this.linkOAuthAccount(user.id, profile);

    this.logger.log(`User ${user.id} logged in via ${profile.provider} (account linked)`);

    return this.authService.login({ id: user.id, email: user.email, sid: '' }, meta);
  }

  private async findOAuthAccount(provider: OAuthProvider, providerAccountId: string) {
    return this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: { provider, providerAccountId },
      },
    });
  }

  private async createOAuthUser(profile: NormalizedOAuthProfile) {
    return this.usersService.createOAuthUser({
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      avatarUrl: profile.avatar,
    });
  }

  private async linkOAuthAccount(userId: string, profile: NormalizedOAuthProfile) {
    await this.prisma.oAuthAccount.create({
      data: {
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
        userId,
      },
    });
    this.logger.log(`OAuth ${profile.provider} account linked to user ${userId}`);
  }
}
