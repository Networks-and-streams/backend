import { HttpException, HttpStatus } from '@nestjs/common';

import { RedisService } from '@/core/redis/redis.service';
import { SubscriptionsService } from '@/subscriptions/subscriptions.service';
import { PrismaContextService } from '@/core/prisma';
import { ForbiddenException } from '@nestjs/common';
import { ComputeQuotaService, FREE_DAILY_COMPUTE_LIMIT } from './compute-quota.service';

function createService(opts: { premium: boolean; counter?: number; verified?: boolean }) {
  let counter = opts.counter ?? 0;
  const redis = {
    get: jest.fn(async () => (counter ? String(counter) : null)),
    incrWithTtl: jest.fn(async () => ++counter),
    decr: jest.fn(async () => --counter),
  };
  const subscriptions = { isActive: jest.fn(async () => opts.premium) };
  const verifiedAt = opts.verified === false ? null : new Date();
  const db = { client: { user: { findUnique: jest.fn(async () => ({ emailVerifiedAt: verifiedAt })) } } };
  const service = new ComputeQuotaService(
    redis as unknown as RedisService,
    subscriptions as unknown as SubscriptionsService,
    db as unknown as PrismaContextService,
  );
  return { service, redis, counter: () => counter };
}

describe('ComputeQuotaService', () => {
  it('never limits or counts premium users', async () => {
    const { service, redis } = createService({ premium: true });

    await service.reserve('user-1');

    expect(redis.incrWithTtl).not.toHaveBeenCalled();
    await expect(service.getQuota('user-1')).resolves.toMatchObject({ unlimited: true, remaining: null });
  });

  it('counts free runs and reports the remaining allowance', async () => {
    const { service } = createService({ premium: false });

    await service.reserve('user-1');
    await service.reserve('user-1');

    await expect(service.getQuota('user-1')).resolves.toMatchObject({
      unlimited: false,
      limit: FREE_DAILY_COMPUTE_LIMIT,
      used: 2,
      remaining: FREE_DAILY_COMPUTE_LIMIT - 2,
    });
  });

  it('rejects with 429 once the daily limit is reached and does not overcount', async () => {
    const { service, counter } = createService({ premium: false, counter: FREE_DAILY_COMPUTE_LIMIT });

    const attempt = service.reserve('user-1');

    await expect(attempt).rejects.toBeInstanceOf(HttpException);
    await expect(attempt).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    expect(counter()).toBe(FREE_DAILY_COMPUTE_LIMIT);
  });

  it('gives the run back when refunded', async () => {
    const { service, counter } = createService({ premium: false });

    const { refund } = await service.reserve('user-1');
    await refund();

    expect(counter()).toBe(0);
  });

  it('locks the free allowance until the email is verified', async () => {
    const { service, redis } = createService({ premium: false, verified: false });

    await expect(service.reserve('user-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(redis.incrWithTtl).not.toHaveBeenCalled();
    await expect(service.getQuota('user-1')).resolves.toMatchObject({ requiresVerification: true, remaining: 0 });
  });

  it('does not require verification for premium users', async () => {
    const { service } = createService({ premium: true, verified: false });

    await expect(service.reserve('user-1')).resolves.toBeDefined();
  });
});
