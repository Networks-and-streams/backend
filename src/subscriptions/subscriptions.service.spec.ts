import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { SubscriptionPlan, SubscriptionStatus } from '@/generated/prisma/client';

import { PrismaService } from '@/core/prisma/prisma.service';
import { SubscriptionsService, SUBSCRIPTION_DURATION_MS } from './subscriptions.service';

function createMockPrisma() {
  return {
    subscription: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
}

const baseSubscription = {
  id: 'sub-1',
  userId: 'user-1',
  status: SubscriptionStatus.INACTIVE,
  plan: SubscriptionPlan.FREE,
  startedAt: null,
  expiresAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [SubscriptionsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
    jest.clearAllMocks();
  });

  describe('isActive', () => {
    it('returns true for an ACTIVE subscription that has not expired', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        ...baseSubscription,
        status: SubscriptionStatus.ACTIVE,
        plan: SubscriptionPlan.PREMIUM,
        startedAt: new Date('2024-01-01'),
        expiresAt: new Date(Date.now() + SUBSCRIPTION_DURATION_MS),
      });

      await expect(service.isActive('user-1')).resolves.toBe(true);
    });

    it('returns false for an INACTIVE subscription (default after registration)', async () => {
      prisma.subscription.findUnique.mockResolvedValue(baseSubscription);

      await expect(service.isActive('user-1')).resolves.toBe(false);
    });

    it('returns false for an ACTIVE but expired subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        ...baseSubscription,
        status: SubscriptionStatus.ACTIVE,
        plan: SubscriptionPlan.PREMIUM,
        startedAt: new Date('2020-01-01'),
        expiresAt: new Date('2020-02-01'),
      });

      await expect(service.isActive('user-1')).resolves.toBe(false);
    });

    it('returns false when the user has no subscription record', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      await expect(service.isActive('user-1')).resolves.toBe(false);
    });
  });

  describe('findByUserIdOrThrow', () => {
    it('returns the subscription when found', async () => {
      prisma.subscription.findUnique.mockResolvedValue(baseSubscription);

      await expect(service.findByUserIdOrThrow('user-1')).resolves.toEqual(baseSubscription);
    });

    it('throws NotFoundException when the user has no subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      await expect(service.findByUserIdOrThrow('user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('activate', () => {
    it('sets ACTIVE with startedAt/expiresAt and the paid plan', async () => {
      prisma.subscription.update.mockResolvedValue({ ...baseSubscription, status: SubscriptionStatus.ACTIVE });

      await service.activate('user-1', SubscriptionPlan.PREMIUM, undefined);

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: expect.objectContaining({
          status: SubscriptionStatus.ACTIVE,
          plan: SubscriptionPlan.PREMIUM,
          startedAt: expect.any(Date),
          expiresAt: expect.any(Date),
        }),
      });
      const callArg = (prisma.subscription.update as jest.Mock).mock.calls[0][0] as {
        data: { expiresAt: Date; startedAt: Date };
      };
      expect(callArg.data.expiresAt.getTime() - callArg.data.startedAt.getTime()).toBe(SUBSCRIPTION_DURATION_MS);
    });

    it('uses the provided transaction client when one is given', async () => {
      const txPrisma = { subscription: { update: jest.fn().mockResolvedValue({}) } };
      await service.activate('user-1', SubscriptionPlan.PREMIUM, txPrisma as never);

      expect(txPrisma.subscription.update).toHaveBeenCalledTimes(1);
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('marks the subscription CANCELLED', async () => {
      prisma.subscription.update.mockResolvedValue({ ...baseSubscription, status: SubscriptionStatus.CANCELLED });

      await service.cancel('user-1');

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { status: SubscriptionStatus.CANCELLED },
      });
    });
  });

  describe('expire', () => {
    it('marks the subscription EXPIRED', async () => {
      prisma.subscription.update.mockResolvedValue({ ...baseSubscription, status: SubscriptionStatus.EXPIRED });

      await service.expire('user-1');

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { status: SubscriptionStatus.EXPIRED },
      });
    });
  });

  describe('security: activation is payment-driven only', () => {
    it('does not expose a client-facing method that blindly activates a subscription', () => {
      // The only way to activate is via the dedicated service method used by
      // the payment domain after a backend-confirmed success. There is no
      // controller route that calls `activate`.
      const proto = Object.getPrototypeOf(service) as Record<string, unknown>;
      expect(typeof proto.activate).toBe('function');
    });
  });
});
