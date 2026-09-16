import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { Prisma } from '@/generated/prisma/client';
import { Subscription, SubscriptionPlan, SubscriptionStatus } from '@/generated/prisma/client';

import { PrismaService } from '@/core/prisma';

export const SUBSCRIPTION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Backend authority check: whether the user may use paid functionality.
   * This is the single service-level gate used by controllers/guards.
   */
  async isActive(userId: string): Promise<boolean> {
    const subscription = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!subscription) return false;
    return subscription.status === SubscriptionStatus.ACTIVE && this.isNotExpired(subscription);
  }

  findByUserId(userId: string): Promise<Subscription | null> {
    return this.prisma.subscription.findUnique({ where: { userId } });
  }

  async findByUserIdOrThrow(userId: string): Promise<Subscription> {
    const subscription = await this.findByUserId(userId);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    return subscription;
  }

  /**
   * Atomically activates the user's subscription. Requires a not-yet-active subscription.
   * Only a successful, backend-confirmed payment may call this.
   */
  activate(userId: string, plan: SubscriptionPlan, tx?: Prisma.TransactionClient): Promise<Subscription> {
    const client = tx ?? this.prisma;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SUBSCRIPTION_DURATION_MS);

    return client.subscription.update({
      where: { userId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        plan,
        startedAt: now,
        expiresAt,
      },
    });
  }

  /**
   * Marks the subscription as cancelled (user-initiated or payment failure).
   */
  cancel(userId: string, tx?: Prisma.TransactionClient): Promise<Subscription> {
    const client = tx ?? this.prisma;
    return client.subscription.update({
      where: { userId },
      data: {
        status: SubscriptionStatus.CANCELLED,
      },
    });
  }

  /**
   * Marks the subscription as expired (access removed after term ends).
   */
  expire(userId: string, tx?: Prisma.TransactionClient): Promise<Subscription> {
    const client = tx ?? this.prisma;
    return client.subscription.update({
      where: { userId },
      data: {
        status: SubscriptionStatus.EXPIRED,
      },
    });
  }

  private isNotExpired(subscription: Subscription): boolean {
    // No expiresAt means the subscription is not time-bound (e.g. lifetime).
    if (!subscription.expiresAt) return true;
    return subscription.expiresAt.getTime() > Date.now();
  }
}
