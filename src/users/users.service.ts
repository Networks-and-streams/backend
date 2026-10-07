import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import type { User } from '@/generated/prisma/client';
import { SubscriptionStatus, SubscriptionPlan } from '@/generated/prisma/client';

import { BCRYPT_SALT_ROUNDS } from '@/common/constants';
import { PrismaContextService } from '@/core/prisma';
import { SessionsService } from '@/sessions/sessions.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(
    private readonly db: PrismaContextService,
    private readonly sessions: SessionsService,
  ) {}

  async create(email: string, password: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    return this.db.transaction(async () => {
      const user = await this.db.client.user.create({
        data: {
          email,
          password: hashedPassword,
        },
      });

      // Every account starts with an inactive subscription; activation is
      // driven exclusively by the payment domain (backend-confirmed success).
      await this.db.client.subscription.create({
        data: {
          userId: user.id,
          status: SubscriptionStatus.INACTIVE,
          plan: SubscriptionPlan.FREE,
        },
      });

      this.logger.log(`User ${user.id} created with email ${email}`);

      return user;
    });
  }

  async createOAuthUser(data: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
    emailVerified?: boolean;
  }): Promise<User> {
    return this.db.transaction(async () => {
      const user = await this.db.client.user.create({
        data: {
          email: data.email,
          emailVerifiedAt: data.emailVerified ? new Date() : null,
        },
      });

      await this.db.client.subscription.create({
        data: {
          userId: user.id,
          status: SubscriptionStatus.INACTIVE,
          plan: SubscriptionPlan.FREE,
        },
      });

      this.logger.log(`User ${user.id} created via OAuth with email ${data.email}`);

      return user;
    });
  }

  /**
   * The verified owner of the email (Google) takes over an unverified account:
   * whoever set its password never proved they own the address, so the
   * password and all sessions are removed and the email is marked verified.
   */
  async claimUnverifiedAccount(userId: string): Promise<void> {
    await this.db.transaction(async () => {
      await this.db.client.user.update({
        where: { id: userId },
        data: { password: null, emailVerifiedAt: new Date() },
      });
      await this.db.client.session.deleteMany({ where: { userId } });
    });
    this.logger.warn(`Unverified account ${userId} claimed via Google: password and sessions removed`);
  }

  /**
   * Permanently deletes the account. Confirmed by the password, or by typing
   * the email for Google-only accounts. Sessions, linked logins, subscription
   * and saved graphs are deleted (DB cascades); payments stay, anonymized
   * (`userId` set to null) for accounting and disputes.
   */
  async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<void> {
    const user = await this.findByIdOrThrow(userId);
    if (user.password) {
      const confirmed = dto.password !== undefined && (await bcrypt.compare(dto.password, user.password));
      if (!confirmed) throw new BadRequestException('Password is incorrect');
    } else if (dto.confirmEmail?.trim().toLowerCase() !== user.email.toLowerCase()) {
      throw new BadRequestException('Type your email exactly to confirm');
    }

    await this.db.client.user.delete({ where: { id: userId } });
    this.logger.log(`User ${userId} deleted their account`);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.db.client.user.findUnique({ where: { email } });
  }

  async findByEmailOrThrow(email: string): Promise<User> {
    const user = await this.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findUserById(id: string): Promise<User | null> {
    return this.db.client.user.findUnique({ where: { id } });
  }

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.findUserById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getProfile(id: string): Promise<ProfileResponseDto> {
    const user = await this.db.client.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        createdAt: true,
        password: true,
        oauthAccounts: { select: { provider: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerifiedAt !== null,
      createdAt: user.createdAt,
      hasPassword: user.password !== null,
      providers: [...new Set(user.oauthAccounts.map((account) => account.provider))],
    };
  }

  /**
   * Changes the password, or sets a first one for Google-only accounts. When a
   * password exists, the current one must be confirmed. Every other session is
   * signed out in the same transaction; `currentSessionId` stays signed in.
   *
   * Wrong current password is a 400, not 401: a 401 would make the client
   * treat the session itself as expired.
   */
  async changePassword(userId: string, currentSessionId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.findByIdOrThrow(userId);

    if (user.password) {
      const confirmed = dto.currentPassword !== undefined && (await bcrypt.compare(dto.currentPassword, user.password));
      if (!confirmed) throw new BadRequestException('Current password is incorrect');
      if (await bcrypt.compare(dto.newPassword, user.password)) {
        throw new BadRequestException('The new password must be different from the current one');
      }
    }

    const password = await bcrypt.hash(dto.newPassword, BCRYPT_SALT_ROUNDS);
    await this.db.transaction(async () => {
      await this.db.client.user.update({ where: { id: userId }, data: { password } });
      await this.sessions.removeAllExcept(userId, currentSessionId);
    });
    this.logger.log(`User ${userId} changed password; other sessions signed out`);
  }

  async getAllUsers(): Promise<User[]> {
    return this.db.client.user.findMany();
  }

  async removeUserById(id: string): Promise<User> {
    await this.findByIdOrThrow(id);
    const user = await this.db.client.user.delete({ where: { id } });
    this.logger.log(`User ${id} removed`);
    return user;
  }
}
