import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import type { User } from '@/generated/prisma/client';
import { SubscriptionStatus, SubscriptionPlan } from '@/generated/prisma/client';

import { BCRYPT_SALT_ROUNDS } from '@/common/constants';
import { PrismaContextService } from '@/core/prisma';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(private readonly db: PrismaContextService) {}

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
  }): Promise<User> {
    return this.db.transaction(async () => {
      const user = await this.db.client.user.create({
        data: {
          email: data.email,
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
