import { Test, TestingModule } from '@nestjs/testing';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import {
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@/generated/prisma/client';

import { SubscriptionsService } from '@/subscriptions/subscriptions.service';
import { PrismaService } from '@/core/prisma/prisma.service';
import paymentConfig from '@/config/loaders/payment.config';
import { PAYMENT_GATEWAY } from './payment.gateway';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

/* ---------------------------------------------------------------- */
/* Test data                                                         */
/* ---------------------------------------------------------------- */

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

const basePayment = {
  id: 'pay-1',
  userId: 'user-1',
  subscriptionId: 'sub-1',
  provider: PaymentProvider.STRIPE,
  paymentMethod: PaymentMethod.GOOGLE_PAY,
  status: PaymentStatus.PENDING,
  plan: SubscriptionPlan.PREMIUM,
  amount: 999,
  currency: 'USD',
  providerPaymentId: null,
  providerMetadata: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

function createMockTx() {
  return {
    payment: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    subscription: {
      update: jest.fn(),
    },
    paymentWebhookEvent: {
      create: jest.fn(),
    },
  };
}

function createMockPrisma() {
  const tx = createMockTx();
  return {
    $transaction: jest.fn((fn: (txArg: ReturnType<typeof createMockTx>) => Promise<unknown>) => fn(tx)),
    payment: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    paymentWebhookEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
}

function createMockSubscriptions() {
  return {
    findByUserIdOrThrow: jest.fn(),
    findByUserId: jest.fn(),
    isActive: jest.fn(),
    activate: jest.fn(),
    cancel: jest.fn(),
    expire: jest.fn(),
  };
}

function createMockGateway() {
  return {
    createPayment: jest.fn(),
    processGooglePay: jest.fn(),
    verifyPayment: jest.fn(),
    refundPayment: jest.fn(),
    verifyWebhook: jest.fn(),
  };
}

const paymentConfigMock = {
  provider: 'stripe',
  defaultCurrency: 'USD',
  webhookSecret: 'test-webhook-secret',
  googlePayMerchantId: 'merchant-1',
};

/* ---------------------------------------------------------------- */

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let tx: ReturnType<typeof createMockTx>;
  let subscriptions: ReturnType<typeof createMockSubscriptions>;
  let gateway: ReturnType<typeof createMockGateway>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    tx = createMockTx();
    prisma.$transaction.mockImplementation((fn: (t: ReturnType<typeof createMockTx>) => Promise<unknown>) => fn(tx));
    subscriptions = createMockSubscriptions();
    gateway = createMockGateway();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: SubscriptionsService, useValue: subscriptions },
        { provide: PAYMENT_GATEWAY, useValue: gateway },
        { provide: paymentConfig.KEY, useValue: paymentConfigMock },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();
  });

  describe('payment creation', () => {
    const dto: CreatePaymentDto = { plan: SubscriptionPlan.PREMIUM, paymentMethod: PaymentMethod.GOOGLE_PAY };

    it('derives amount/currency server-side and never accepts a client amount', async () => {
      subscriptions.findByUserIdOrThrow.mockResolvedValue(baseSubscription);
      prisma.payment.findFirst.mockResolvedValue(null);
      prisma.payment.create.mockResolvedValue({ ...basePayment });

      await service.createPayment('user-1', dto);

      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            subscriptionId: 'sub-1',
            provider: PaymentProvider.STRIPE,
            paymentMethod: PaymentMethod.GOOGLE_PAY,
            plan: SubscriptionPlan.PREMIUM,
            status: PaymentStatus.PENDING,
            amount: 999, // server-side plan pricing, not client input
            currency: 'USD',
          }),
        }),
      );
    });

    it('rejects a plan that requires no payment', async () => {
      subscriptions.findByUserIdOrThrow.mockResolvedValue(baseSubscription);

      await expect(
        service.createPayment('user-1', { plan: SubscriptionPlan.FREE, paymentMethod: PaymentMethod.CARD }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('throws when the user has no subscription', async () => {
      subscriptions.findByUserIdOrThrow.mockRejectedValue(new NotFoundException('Subscription not found'));

      await expect(service.createPayment('user-1', dto)).rejects.toThrow(NotFoundException);
    });

    it('returns the existing PENDING payment instead of creating a duplicate (idempotency)', async () => {
      subscriptions.findByUserIdOrThrow.mockResolvedValue(baseSubscription);
      prisma.payment.findFirst.mockResolvedValue(basePayment);

      const result = await service.createPayment('user-1', dto);

      expect(result).toEqual(basePayment);
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });
  });

  describe('ownership validation', () => {
    it('returns the payment when it belongs to the user', async () => {
      prisma.payment.findFirst.mockResolvedValue(basePayment);

      const result = await service.getPayment('user-1', 'pay-1');

      expect(prisma.payment.findFirst).toHaveBeenCalledWith({ where: { id: 'pay-1', userId: 'user-1' } });
      expect(result).toEqual(basePayment);
    });

    it("throws 404 for another user's payment (indistinguishable from non-existent)", async () => {
      prisma.payment.findFirst.mockResolvedValue(null);

      await expect(service.getPayment('user-2', 'pay-1')).rejects.toThrow(NotFoundException);
    });

    it('throws 404 for an unknown payment', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);

      await expect(service.getPayment('user-1', 'does-not-exist')).rejects.toThrow(NotFoundException);
    });
  });

  describe('processGooglePay', () => {
    const dto = { tokenData: { protocolVersion: 'ECv2', signature: 'sig', signedMessage: '{"x":1}' } };
    const processingPayment = { ...basePayment, status: PaymentStatus.PROCESSING };

    it('processes a successful provider response and activates the subscription', async () => {
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });
      prisma.payment.findFirst
        .mockResolvedValueOnce(basePayment)
        .mockResolvedValueOnce({ ...basePayment, status: PaymentStatus.SUCCEEDED });
      gateway.processGooglePay.mockResolvedValue({ status: 'succeeded', providerPaymentId: 'psp-1' });
      tx.payment.update.mockResolvedValue({
        ...basePayment,
        status: PaymentStatus.SUCCEEDED,
        providerPaymentId: 'psp-1',
      });
      subscriptions.activate.mockResolvedValue({});

      const result = await service.processGooglePay('user-1', 'pay-1', dto);

      // Atomic claim first
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { id: 'pay-1', userId: 'user-1', status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.PROCESSING },
      });
      // Gateway receives the raw Google Pay token
      expect(gateway.processGooglePay).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: 'pay-1',
          userId: 'user-1',
          plan: SubscriptionPlan.PREMIUM,
          amount: 999,
          currency: 'USD',
          tokenData: dto.tokenData,
        }),
      );
      // Payment + subscription updated atomically
      expect(tx.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-1' },
          data: expect.objectContaining({ status: PaymentStatus.SUCCEEDED, providerPaymentId: 'psp-1' }),
        }),
      );
      expect(subscriptions.activate).toHaveBeenCalledWith('user-1', SubscriptionPlan.PREMIUM, tx);
      expect(result.status).toBe(PaymentStatus.SUCCEEDED);
    });

    it('stores a failed provider response without activating the subscription', async () => {
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });
      prisma.payment.findFirst.mockResolvedValueOnce(basePayment);
      prisma.payment.findUnique.mockResolvedValue({
        ...basePayment,
        status: PaymentStatus.FAILED,
        providerMetadata: { failureReason: 'card_declined' },
      });
      gateway.processGooglePay.mockResolvedValue({ status: 'failed', failureReason: 'card_declined' });

      const result = await service.processGooglePay('user-1', 'pay-1', dto);

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.FAILED }),
        }),
      );
      expect(subscriptions.activate).not.toHaveBeenCalled();
      expect(result.status).toBe(PaymentStatus.FAILED);
    });

    it('keeps the payment PROCESSING when the PSP reports processing (webhook is the source of truth)', async () => {
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });
      prisma.payment.findFirst.mockResolvedValueOnce(basePayment);
      prisma.payment.findUnique.mockResolvedValue(processingPayment);
      gateway.processGooglePay.mockResolvedValue({ status: 'processing', providerPaymentId: 'psp-1' });

      const result = await service.processGooglePay('user-1', 'pay-1', dto);

      expect(result.status).toBe(PaymentStatus.PROCESSING);
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ providerPaymentId: 'psp-1' }) }),
      );
      expect(subscriptions.activate).not.toHaveBeenCalled();
    });

    it('rejects processing when the payment belongs to another user', async () => {
      prisma.payment.updateMany.mockResolvedValue({ count: 0 });
      prisma.payment.findUnique.mockResolvedValue(basePayment); // found, but belongs to user-1, not user-2

      await expect(service.processGooglePay('user-2', 'pay-1', dto)).rejects.toThrow(NotFoundException);
      expect(gateway.processGooglePay).not.toHaveBeenCalled();
    });

    it('rejects processing an unknown payment', async () => {
      prisma.payment.updateMany.mockResolvedValue({ count: 0 });
      prisma.payment.findUnique.mockResolvedValue(null);

      await expect(service.processGooglePay('user-1', 'missing', dto)).rejects.toThrow(NotFoundException);
    });

    it('rejects invalid payment state (already PROCESSING) with 409', async () => {
      prisma.payment.updateMany.mockResolvedValue({ count: 0 });
      prisma.payment.findUnique.mockResolvedValue({ ...basePayment, status: PaymentStatus.PROCESSING });

      await expect(service.processGooglePay('user-1', 'pay-1', dto)).rejects.toThrow(ConflictException);
      expect(gateway.processGooglePay).not.toHaveBeenCalled();
    });

    it('rejects duplicate processing of a terminal payment with 409', async () => {
      prisma.payment.updateMany.mockResolvedValue({ count: 0 });
      prisma.payment.findUnique.mockResolvedValue({ ...basePayment, status: PaymentStatus.SUCCEEDED });

      await expect(service.processGooglePay('user-1', 'pay-1', dto)).rejects.toThrow(ConflictException);
      expect(gateway.processGooglePay).not.toHaveBeenCalled();
    });

    it('leaves the payment PROCESSING and throws 502 when the PSP is unreachable', async () => {
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });
      prisma.payment.findFirst.mockResolvedValueOnce(basePayment);
      gateway.processGooglePay.mockRejectedValue(new Error('connection timeout'));

      await expect(service.processGooglePay('user-1', 'pay-1', dto)).rejects.toThrow(BadGatewayException);
      expect(tx.payment.update).not.toHaveBeenCalled();
      expect(subscriptions.activate).not.toHaveBeenCalled();
    });
  });

  describe('webhook handling', () => {
    const headers = { 'x-psp-signature': 'sig' };

    function webhookEvent(
      status: 'succeeded' | 'failed' | 'processing' | 'refunded' | 'pending',
      providerPaymentId = 'psp-1',
    ) {
      return { type: 'payment.updated', eventId: 'evt_test_1', providerPaymentId, status };
    }

    // Default: event idempotency lookup returns null (no duplicate).
    beforeEach(() => {
      prisma.paymentWebhookEvent.findUnique.mockResolvedValue(null);
    });

    it('rejects a webhook with an invalid signature', async () => {
      gateway.verifyWebhook.mockResolvedValue({ valid: false });

      await expect(service.handleWebhook(headers, {})).rejects.toThrow(UnauthorizedException);
      expect(prisma.payment.findUnique).not.toHaveBeenCalled();
    });

    it('acknowledges a webhook for an unknown payment without state changes', async () => {
      gateway.verifyWebhook.mockResolvedValue({ valid: true, event: webhookEvent('succeeded') });
      prisma.payment.findUnique.mockResolvedValue(null);

      const result = await service.handleWebhook(headers, {});

      expect(result).toEqual({ received: true });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('marks the payment SUCCEEDED and activates the subscription on a valid success webhook', async () => {
      gateway.verifyWebhook.mockResolvedValue({ valid: true, event: webhookEvent('succeeded') });
      prisma.payment.findUnique.mockResolvedValueOnce(basePayment);
      tx.payment.findUnique.mockResolvedValue(basePayment);
      tx.payment.update.mockResolvedValue({ ...basePayment, status: PaymentStatus.SUCCEEDED });
      subscriptions.activate.mockResolvedValue({});
      tx.paymentWebhookEvent.create.mockResolvedValue({});

      const result = await service.handleWebhook(headers, {});

      expect(tx.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.SUCCEEDED }),
        }),
      );
      expect(subscriptions.activate).toHaveBeenCalledWith('user-1', SubscriptionPlan.PREMIUM, tx);
      expect(tx.paymentWebhookEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ provider: PaymentProvider.STRIPE, eventId: 'evt_test_1' }),
        }),
      );
      expect(result).toEqual({ received: true });
    });

    it('marks the payment FAILED on a valid failure webhook without activating the subscription', async () => {
      gateway.verifyWebhook.mockResolvedValue({ valid: true, event: webhookEvent('failed') });
      prisma.payment.findUnique.mockResolvedValueOnce(basePayment);
      tx.payment.findUnique.mockResolvedValue(basePayment);
      tx.payment.update.mockResolvedValue({ ...basePayment, status: PaymentStatus.FAILED });
      tx.paymentWebhookEvent.create.mockResolvedValue({});

      await service.handleWebhook(headers, {});

      expect(tx.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.FAILED }),
        }),
      );
      expect(subscriptions.activate).not.toHaveBeenCalled();
    });

    it('is idempotent: a duplicate success webhook is a no-op', async () => {
      const succeededPayment = { ...basePayment, status: PaymentStatus.SUCCEEDED };
      gateway.verifyWebhook.mockResolvedValue({ valid: true, event: webhookEvent('succeeded') });
      prisma.payment.findUnique.mockResolvedValueOnce(succeededPayment);

      const result = await service.handleWebhook(headers, {});

      expect(result).toEqual({ received: true });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(subscriptions.activate).not.toHaveBeenCalled();
    });

    it('is idempotent: an already processed payment ignores conflicting webhooks', async () => {
      const succeededPayment = { ...basePayment, status: PaymentStatus.SUCCEEDED };
      gateway.verifyWebhook.mockResolvedValue({ valid: true, event: webhookEvent('failed') });
      prisma.payment.findUnique.mockResolvedValueOnce(succeededPayment);

      const result = await service.handleWebhook(headers, {});

      expect(result).toEqual({ received: true });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('ignores an invalid state transition (e.g. FAILED -> SUCCEEDED)', async () => {
      const failedPayment = { ...basePayment, status: PaymentStatus.FAILED };
      gateway.verifyWebhook.mockResolvedValue({ valid: true, event: webhookEvent('succeeded') });
      prisma.payment.findUnique.mockResolvedValueOnce(failedPayment);

      const result = await service.handleWebhook(headers, {});

      expect(result).toEqual({ received: true });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(subscriptions.activate).not.toHaveBeenCalled();
    });

    it('skips the update when a concurrent webhook already changed the status (race safety)', async () => {
      gateway.verifyWebhook.mockResolvedValue({ valid: true, event: webhookEvent('succeeded') });
      prisma.payment.findUnique.mockResolvedValueOnce(basePayment);
      // Concurrent delivery flipped the state before this one ran.
      tx.payment.findUnique.mockResolvedValue({ ...basePayment, status: PaymentStatus.SUCCEEDED });

      const result = await service.handleWebhook(headers, {});

      expect(result).toEqual({ received: true });
      expect(tx.payment.update).not.toHaveBeenCalled();
      expect(subscriptions.activate).not.toHaveBeenCalled();
    });

    it('is idempotent: a previously recorded provider event is acknowledged without re-processing', async () => {
      // The same Stripe event (same eventId) was already processed.
      prisma.paymentWebhookEvent.findUnique.mockResolvedValue({
        id: 'wev-1',
        provider: PaymentProvider.STRIPE,
        eventId: 'evt_test_1',
        paymentId: 'pay-1',
        receivedAt: new Date(),
        processedAt: new Date(),
      });
      gateway.verifyWebhook.mockResolvedValue({ valid: true, event: webhookEvent('succeeded') });

      const result = await service.handleWebhook(headers, {});

      expect(result).toEqual({ received: true });
      // No payment lookup happened — the event was already recorded as processed.
      expect(prisma.payment.findUnique).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(subscriptions.activate).not.toHaveBeenCalled();
    });

    it('persists the webhook event record inside the same transaction as the payment update', async () => {
      gateway.verifyWebhook.mockResolvedValue({ valid: true, event: webhookEvent('succeeded') });
      prisma.payment.findUnique.mockResolvedValueOnce(basePayment);
      tx.payment.findUnique.mockResolvedValue(basePayment);
      tx.payment.update.mockResolvedValue({ ...basePayment, status: PaymentStatus.SUCCEEDED });
      tx.paymentWebhookEvent.create.mockResolvedValue({});
      subscriptions.activate.mockResolvedValue({});

      await service.handleWebhook(headers, {});

      // Both the payment update, subscription activation, and event record
      // happen within a single $transaction — all-or-nothing.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.paymentWebhookEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ paymentId: 'pay-1', eventId: 'evt_test_1' }),
        }),
      );
    });
  });
});
