import { ForbiddenException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { RedisService } from '@/core/redis/redis.service';
import { SubscriptionsService } from '@/subscriptions/subscriptions.service';
import { PrismaContextService } from '@/core/prisma';

/** Successful algorithm runs a user without an active subscription gets per UTC day. */
export const FREE_DAILY_COMPUTE_LIMIT = 5;

// Keys are per UTC date, so the TTL only garbage-collects old counters.
const COUNTER_TTL_SECONDS = 2 * 24 * 60 * 60;

export interface ComputeQuota {
  /** True for an active subscription: no daily limit applies. */
  unlimited: boolean;
  /** True when the free allowance is locked until the user verifies their email. */
  requiresVerification: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  /** When the free counter resets (next UTC midnight); null when unlimited. */
  resetsAt: string | null;
}

/**
 * Daily compute allowance (freemium gate).
 *
 * Premium users (active subscription) are unlimited. Everyone else gets
 * {@link FREE_DAILY_COMPUTE_LIMIT} successful runs per UTC day, counted in
 * Redis. A run is reserved atomically before computing (so concurrent requests
 * cannot overshoot the limit) and refunded if the computation fails.
 */
@Injectable()
export class ComputeQuotaService {
  constructor(
    private readonly redis: RedisService,
    private readonly subscriptions: SubscriptionsService,
    private readonly db: PrismaContextService,
  ) {}

  async getQuota(userId: string): Promise<ComputeQuota> {
    if (await this.subscriptions.isActive(userId)) return UNLIMITED;
    if (!(await this.isEmailVerified(userId))) return LOCKED_UNTIL_VERIFIED;
    const used = Number(await this.redis.get(counterKey(userId))) || 0;
    return limitedQuota(used);
  }

  /**
   * Reserves one run. Throws 429 when the free allowance is used up.
   * Returns a `refund` callback to give the run back if computing fails.
   */
  async reserve(userId: string): Promise<{ refund: () => Promise<void> }> {
    if (await this.subscriptions.isActive(userId)) {
      return { refund: async () => {} };
    }

    if (!(await this.isEmailVerified(userId))) {
      throw new ForbiddenException('Verify your email to unlock the free daily runs, or upgrade to Premium.');
    }

    const key = counterKey(userId);
    const used = await this.redis.incrWithTtl(key, COUNTER_TTL_SECONDS);
    if (used > FREE_DAILY_COMPUTE_LIMIT) {
      await this.redis.decr(key);
      throw new HttpException(
        `Daily limit of ${FREE_DAILY_COMPUTE_LIMIT} free runs reached. Upgrade to Premium for unlimited runs.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return { refund: () => this.redis.decr(key).then(() => undefined) };
  }

  private async isEmailVerified(userId: string): Promise<boolean> {
    const user = await this.db.client.user.findUnique({ where: { id: userId }, select: { emailVerifiedAt: true } });
    return Boolean(user?.emailVerifiedAt);
  }
}

const UNLIMITED: ComputeQuota = {
  unlimited: true,
  requiresVerification: false,
  limit: null,
  used: 0,
  remaining: null,
  resetsAt: null,
};

const LOCKED_UNTIL_VERIFIED: ComputeQuota = {
  unlimited: false,
  requiresVerification: true,
  limit: 0,
  used: 0,
  remaining: 0,
  resetsAt: null,
};

function limitedQuota(used: number): ComputeQuota {
  return {
    unlimited: false,
    requiresVerification: false,
    limit: FREE_DAILY_COMPUTE_LIMIT,
    used,
    remaining: Math.max(0, FREE_DAILY_COMPUTE_LIMIT - used),
    resetsAt: nextUtcMidnight().toISOString(),
  };
}

function counterKey(userId: string): string {
  return `compute:quota:${userId}:${new Date().toISOString().slice(0, 10)}`;
}

function nextUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}
