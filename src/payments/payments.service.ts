import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import type { Payment } from '@/generated/prisma/client';
import { PaymentProvider, PaymentStatus, Prisma } from '@/generated/prisma/client';

import paymentConfig from '@/config/loaders/payment.config';
import { PrismaService } from '@/core/prisma';
import { SubscriptionsService } from '@/subscriptions/subscriptions.service';
import { PAYMENT_GATEWAY } from './payment.gateway';
import type { PaymentGateway } from './payment.gateway';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { GooglePayDto } from './dto/google-pay.dto';
import { canTransitionPayment, getPlanPricing, WEBHOOK_STATUS_TO_PAYMENT_STATUS } from './payment.types';

const PAYMENT_PROVIDER_FROM_CONFIG: Record<string, PaymentProvider> = {
  stripe: PaymentProvider.STRIPE,
  liqpay: PaymentProvider.LIQPAY,
  wayforpay: PaymentProvider.WAYFORPAY,
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,

    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    @Inject(paymentConfig.KEY) private readonly payment: ConfigType<typeof paymentConfig>,
  ) {}

  /**
   * Creates a PENDING payment for the authenticated user.
   *
   * - The amount/currency are derived server-side from `plan` — never from the client.
   * - If a PENDING payment already exists for the same subscription, it is returned
   *   (idempotency: repeated frontend requests must not create duplicates).
   */
  async createPayment(userId: string, dto: CreatePaymentDto): Promise<Payment> {
    const subscription = await this.subscriptionsService.findByUserIdOrThrow(userId);

    const pricing = getPlanPricing(dto.plan);
    if (pricing.amount <= 0) {
      throw new BadRequestException(`Plan ${dto.plan} does not require payment`);
    }

    // Idempotency: reuse an existing payable payment if present.
    const existing = await this.prisma.payment.findFirst({
      where: { userId, subscriptionId: subscription.id, status: PaymentStatus.PENDING },
    });
    if (existing) {
      this.logger.log(`Reusing existing PENDING payment ${existing.id} for user ${userId}`);
      return existing;
    }

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        subscriptionId: subscription.id,
        provider: this.resolveProvider(this.payment.provider),
        paymentMethod: dto.paymentMethod,
        plan: dto.plan,
        status: PaymentStatus.PENDING,
        amount: pricing.amount,
        currency: pricing.currency,
      },
    });

    this.logger.log(
      `Payment ${payment.id} created for user ${userId}: ${pricing.amount} ${pricing.currency} (${dto.plan})`,
    );
    return payment;
  }

  /**
   * Returns a payment owned by the given user. Other users' payments are
   * indistinguishable from non-existent payments (404).
   */
  async getPayment(userId: string, paymentId: string): Promise<Payment> {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, userId } });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  /**
   * Submits a Google Pay payment token for an existing PENDING payment.
   *
   * - The payment is atomically claimed (PENDING → PROCESSING) so concurrent
   *   requests cannot process the same payment twice.
   * - The PSP result is persisted; the subscription is only activated on a
   *   backend-confirmed success. A frontend-reported success is never trusted.
   * - If the PSP cannot be reached, the payment stays PROCESSING and the
   *   webhook remains the source of truth for the final state.
   */
  async processGooglePay(userId: string, paymentId: string, dto: GooglePayDto): Promise<Payment> {
    // Atomic claim — only one request can move PENDING → PROCESSING.
    const claimed = await this.prisma.payment.updateMany({
      where: { id: paymentId, userId, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.PROCESSING },
    });

    if (claimed.count === 0) {
      await this.throwIfNotProcessable(userId, paymentId);
    }

    const payment = await this.getPayment(userId, paymentId);

    try {
      const result = await this.gateway.processGooglePay({
        paymentId: payment.id,
        userId,
        subscriptionId: payment.subscriptionId,
        plan: payment.plan,
        amount: payment.amount,
        currency: payment.currency,
        tokenData: dto.tokenData,
      });

      switch (result.status) {
        case 'succeeded':
          return this.completeSuccessfulPayment(payment, result.providerPaymentId, result.metadata);
        case 'failed':
          this.logger.warn(`Payment ${payment.id} failed at PSP: ${result.failureReason ?? 'no reason provided'}`);
          return this.markPaymentFailed(payment.id, result.providerPaymentId, result.failureReason);
        case 'processing':
        default:
          this.logger.log(`Payment ${payment.id} remains PROCESSING — awaiting PSP webhook`);
          return this.attachProviderReference(payment.id, result.providerPaymentId);
      }
    } catch (error) {
      // Network/timeout/PSP error. The PSP may or may not have processed the
      // charge — only the webhook can tell. Leave PROCESSING, do not fabricate
      // a failure and do not activate anything.
      this.logger.error(`Google Pay processing failed for payment ${payment.id}`, error as Error);
      throw new BadGatewayException(
        'The payment could not be confirmed at this time. Your payment status will be updated automatically.',
      );
    }
  }

  /**
   * Handles a PSP webhook delivery.
   *
   * - Signature is verified first — unverified payloads are rejected.
   * - Repeated deliveries are idempotent: already-terminal payments are no-ops.
   * - Payment + subscription updates happen atomically in a single transaction.
   */
  async handleWebhook(headers: Record<string, string>, body: unknown): Promise<{ received: boolean }> {
    const verification = await this.gateway.verifyWebhook({ headers, body });

    if (!verification.valid || !verification.event) {
      this.logger.warn('Rejected webhook with invalid signature');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const event = verification.event;
    const providerPaymentId = event.providerPaymentId;

    const payment = await this.prisma.payment.findUnique({ where: { providerPaymentId } });
    if (!payment) {
      // Unknown reference — acknowledge so the PSP stops retrying, log for audit.
      this.logger.warn(`Webhook for unknown provider payment ID ${providerPaymentId}`);
      return { received: true };
    }

    const newStatus = WEBHOOK_STATUS_TO_PAYMENT_STATUS[event.status];
    if (!newStatus) {
      this.logger.warn(`Webhook status ${event.status} cannot be mapped to a payment status`);
      return { received: true };
    }

    // Idempotency: terminal payments are never re-processed.
    if (!canTransitionPayment(payment.status, newStatus)) {
      this.logger.log(
        `Webhook for payment ${payment.id} ignored: ${payment.status} -> ${newStatus} is not a valid transition`,
      );
      return { received: true };
    }

    await this.prisma.$transaction(async (tx) => {
      const current = await tx.payment.findUnique({ where: { id: payment.id } });
      // Guard against concurrent webhook deliveries.
      if (!current || current.status !== payment.status) {
        this.logger.log(`Webhook for payment ${payment.id} raced with another update — skipped`);
        return;
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: newStatus,
          providerMetadata: (event.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });

      if (newStatus === PaymentStatus.SUCCEEDED && payment.subscriptionId) {
        await this.subscriptionsService.activate(payment.userId, payment.plan, tx);
        this.logger.log(`Subscription ${payment.subscriptionId} activated after successful payment ${payment.id}`);
      }
    });

    this.logger.log(`Webhook processed: payment ${payment.id} -> ${newStatus}`);
    return { received: true };
  }

  private async completeSuccessfulPayment(
    payment: Payment,
    providerPaymentId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<Payment> {
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCEEDED,
          providerPaymentId: providerPaymentId ?? undefined,
          providerMetadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });

      if (payment.subscriptionId) {
        await this.subscriptionsService.activate(payment.userId, payment.plan, tx);
      }
    });

    this.logger.log(`Payment ${payment.id} succeeded and subscription activated`);
    return this.getPayment(payment.userId, payment.id);
  }

  private async markPaymentFailed(paymentId: string, providerPaymentId?: string, reason?: string): Promise<Payment> {
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.FAILED,
        providerPaymentId: providerPaymentId ?? undefined,
        providerMetadata: (reason ? { failureReason: reason } : undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    return this.getPaymentById(paymentId);
  }

  private async attachProviderReference(paymentId: string, providerPaymentId?: string): Promise<Payment> {
    if (providerPaymentId) {
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: { providerPaymentId },
      });
    }
    return this.getPaymentById(paymentId);
  }

  /**
   * If the payment could not be claimed, inspect it and throw the appropriate
   * error without leaking other users' payment existence.
   */
  private async throwIfNotProcessable(userId: string, paymentId: string): Promise<never> {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });

    if (!payment || payment.userId !== userId) {
      throw new NotFoundException('Payment not found');
    }

    switch (payment.status) {
      case PaymentStatus.PROCESSING:
        throw new ConflictException('Payment is already being processed');
      case PaymentStatus.SUCCEEDED:
      case PaymentStatus.FAILED:
      case PaymentStatus.CANCELLED:
      case PaymentStatus.REFUNDED:
        throw new ConflictException(`Payment is already in ${payment.status} state`);
      default:
        throw new ConflictException('Payment cannot be processed in its current state');
    }
  }

  private async getPaymentById(paymentId: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  private resolveProvider(provider: string): PaymentProvider {
    const resolved = PAYMENT_PROVIDER_FROM_CONFIG[provider];
    if (!resolved) {
      this.logger.warn(`Unknown payment provider configured: "${provider}", falling back to ${PaymentProvider.STRIPE}`);
      return PaymentProvider.STRIPE;
    }
    return resolved;
  }
}
