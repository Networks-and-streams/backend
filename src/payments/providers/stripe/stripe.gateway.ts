import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';

import type { PaymentGateway } from '@/payments/payment.gateway';
import type {
  CreatePaymentRequest,
  CreatePaymentResult,
  ProcessGooglePayRequest,
  ProcessGooglePayResult,
  RefundPaymentRequest,
  RefundPaymentResult,
  VerifyPaymentRequest,
  VerifyPaymentResult,
  VerifyWebhookRequest,
  VerifyWebhookResult,
  WebhookEvent,
} from '@/payments/payment.types';

/**
 * Stripe TEST-mode payment gateway adapter.
 *
 * This adapter implements the provider-agnostic `PaymentGateway` contract
 * using the Stripe SDK. It is the only module in the application that
 * imports or depends on Stripe-specific types.
 *
 * All payments run against Stripe's test API (sk_test_... / whsec_...).
 * No real money is ever moved.
 */
@Injectable()
export class StripeGateway implements PaymentGateway {
  private readonly logger = new Logger(StripeGateway.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(secretKey: string, webhookSecret: string, apiVersion?: string) {
    this.stripe = new Stripe(secretKey, {
      apiVersion: (apiVersion as Stripe.LatestApiVersion) ?? undefined,
    });
    this.webhookSecret = webhookSecret;
  }

  /* ------------------------------------------------------------------ */
  /* PaymentGateway contract                                             */
  /* ------------------------------------------------------------------ */

  /**
   * Creates a Stripe PaymentIntent for the given amount/currency.
   *
   * The service layer derives amount/currency from server-side plan pricing;
   * the client never provides these values.
   */
  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResult> {
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: request.amount,
      currency: request.currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: request.userId,
        plan: request.plan,
      },
    });

    this.logger.log(`Stripe PaymentIntent created: ${paymentIntent.id}`);

    return {
      providerPaymentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret ?? undefined,
      metadata: { stripePaymentIntentId: paymentIntent.id },
    };
  }

  /**
   * Processes a Google Pay payment through Stripe.
   *
   * Flow:
   * 1. Extract the token from the Google Pay tokenization data.
   * 2. Create a Stripe PaymentMethod from the token.
   * 3. Create and confirm a PaymentIntent with the PaymentMethod.
   *
   * The amount/currency come from the server-side payment record — never
   * from the client-provided token data.
   */
  async processGooglePay(request: ProcessGooglePayRequest): Promise<ProcessGooglePayResult> {
    const token = this.extractGooglePayToken(request.tokenData);
    if (!token) {
      this.logger.warn('Invalid Google Pay token format — cannot extract token');
      return { status: 'failed', failureReason: 'Invalid Google Pay token format' };
    }

    try {
      // Create a PaymentMethod from the Google Pay token.
      const paymentMethod = await this.createPaymentMethodFromToken(token);

      // Create and confirm a PaymentIntent with the PaymentMethod.
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: request.amount,
        currency: request.currency.toLowerCase(),
        payment_method: paymentMethod.id,
        confirm: true,
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        metadata: {
          userId: request.userId,
          plan: request.plan,
          paymentId: request.paymentId,
        },
      });

      this.logger.log(`Stripe PaymentIntent confirmed: ${paymentIntent.id} (status: ${paymentIntent.status})`);

      return this.mapPaymentIntentResult(paymentIntent);
    } catch (error) {
      this.logger.error('Stripe Google Pay processing failed', error as Error);
      throw error; // Let the service layer handle the error
    }
  }

  /**
   * Retrieves a PaymentIntent from Stripe to check its current status.
   */
  async verifyPayment(request: VerifyPaymentRequest): Promise<VerifyPaymentResult> {
    const paymentIntent = await this.stripe.paymentIntents.retrieve(request.providerPaymentId);

    return {
      status: this.mapStripeStatus(paymentIntent.status),
      metadata: { stripePaymentIntentId: paymentIntent.id },
    };
  }

  /**
   * Creates a refund for a Stripe PaymentIntent.
   */
  async refundPayment(request: RefundPaymentRequest): Promise<RefundPaymentResult> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: request.providerPaymentId,
        ...(request.amount != null ? { amount: request.amount } : {}),
      });

      this.logger.log(`Stripe refund created: ${refund.id} for PI ${request.providerPaymentId}`);

      return { refunded: true, refundId: refund.id };
    } catch (error) {
      this.logger.error('Stripe refund failed', error as Error);
      return { refunded: false };
    }
  }

  /**
   * Verifies a Stripe webhook signature and parses the event into a
   * normalized `WebhookEvent`.
   *
   * The raw body (Buffer) is required for Stripe's signature verification.
   */
  verifyWebhook(request: VerifyWebhookRequest): Promise<VerifyWebhookResult> {
    const signature = request.headers['stripe-signature'];
    if (!signature) {
      this.logger.warn('Webhook missing stripe-signature header');
      return Promise.resolve({ valid: false });
    }

    const rawBody = request.body;
    if (!Buffer.isBuffer(rawBody)) {
      this.logger.warn('Webhook body is not a Buffer — cannot verify signature');
      return Promise.resolve({ valid: false });
    }

    try {
      const event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);

      const normalizedEvent = this.normalizeStripeEvent(event);
      if (!normalizedEvent) {
        // Valid signature but unhandled event type — acknowledge without processing.
        this.logger.log(`Webhook acknowledged (unhandled type: ${event.type})`);
        return Promise.resolve({ valid: true });
      }

      return Promise.resolve({ valid: true, event: normalizedEvent });
    } catch (error) {
      this.logger.warn(`Webhook signature verification failed: ${(error as Error).message}`);
      return Promise.resolve({ valid: false });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Private helpers                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Extracts the payment token from Google Pay tokenization data.
   *
   * Google Pay's `PaymentData.paymentMethodData.tokenizationData.token`
   * may be:
   * - A Stripe PaymentMethod ID (`pm_...`)
   * - A Stripe Token ID (`tok_...`)
   * - A JSON string containing a Stripe PaymentMethod object
   */
  private extractGooglePayToken(tokenData: Record<string, unknown>): string | null {
    // Try the standard Google Pay PaymentData structure.
    const paymentMethodData = tokenData.paymentMethodData as Record<string, unknown> | undefined;
    const tokenizationData = paymentMethodData?.tokenizationData as Record<string, unknown> | undefined;
    const token = tokenizationData?.token;

    if (typeof token === 'string' && token.length > 0) {
      return token;
    }

    // Fallback: try a flat `token` field.
    if (typeof tokenData.token === 'string' && tokenData.token.length > 0) {
      return tokenData.token;
    }

    return null;
  }

  /**
   * Creates a Stripe PaymentMethod from a Google Pay token.
   *
   * Handles:
   * - Stripe PaymentMethod IDs (`pm_...`) — retrieve directly
   * - Stripe Token IDs (`tok_...`) — create PM from token
   * - JSON-encoded PaymentMethod data — parse and create
   */
  private async createPaymentMethodFromToken(token: string): Promise<Stripe.PaymentMethod> {
    // Direct PaymentMethod ID.
    if (token.startsWith('pm_')) {
      return this.stripe.paymentMethods.retrieve(token);
    }

    // Stripe Token ID.
    if (token.startsWith('tok_')) {
      return this.stripe.paymentMethods.create({
        type: 'card',
        card: { token },
      });
    }

    // JSON-encoded payment method data — try to parse and create.
    try {
      const parsed = JSON.parse(token) as Record<string, unknown>;
      if (typeof parsed.id === 'string' && parsed.id.startsWith('pm_')) {
        return this.stripe.paymentMethods.retrieve(parsed.id);
      }
    } catch {
      // Not valid JSON — fall through.
    }

    // Last resort: try as a token string.
    return this.stripe.paymentMethods.create({
      type: 'card',
      card: { token },
    });
  }

  /**
   * Maps a Stripe PaymentIntent to a normalized `ProcessGooglePayResult`.
   */
  private mapPaymentIntentResult(pi: Stripe.PaymentIntent): ProcessGooglePayResult {
    const status = this.mapStripeStatus(pi.status);
    return {
      providerPaymentId: pi.id,
      status,
      metadata: { stripePaymentIntentId: pi.id },
    };
  }

  /**
   * Maps a Stripe PaymentIntent status to the gateway's normalized status.
   */
  private mapStripeStatus(stripeStatus: string): 'succeeded' | 'processing' | 'failed' {
    switch (stripeStatus) {
      case 'succeeded':
        return 'succeeded';
      case 'processing':
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
      case 'requires_capture':
        return 'processing';
      case 'canceled':
      default:
        return 'failed';
    }
  }

  /**
   * Converts a Stripe event into a normalized `WebhookEvent`.
   *
   * Only payment-relevant events are mapped. Other events (e.g.
   * `payment_intent.created`) are acknowledged but not processed.
   */
  private normalizeStripeEvent(event: Stripe.Event): WebhookEvent | null {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi: Stripe.PaymentIntent = event.data.object;
        return {
          type: event.type,
          eventId: event.id,
          providerPaymentId: pi.id,
          status: 'succeeded',
          metadata: pi.metadata,
        };
      }

      case 'payment_intent.payment_failed': {
        const pi: Stripe.PaymentIntent = event.data.object;
        return {
          type: event.type,
          eventId: event.id,
          providerPaymentId: pi.id,
          status: 'failed',
          metadata: {
            ...pi.metadata,
            failureReason: pi.last_payment_error?.message,
          },
        };
      }

      case 'payment_intent.processing': {
        const pi: Stripe.PaymentIntent = event.data.object;
        return {
          type: event.type,
          eventId: event.id,
          providerPaymentId: pi.id,
          status: 'processing',
          metadata: pi.metadata,
        };
      }

      case 'charge.refunded': {
        const charge: Stripe.Charge = event.data.object;
        const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
        if (!piId) {
          this.logger.warn(`charge.refunded event without payment_intent: ${charge.id}`);
          return null;
        }
        return {
          type: event.type,
          eventId: event.id,
          providerPaymentId: piId,
          status: 'refunded',
          metadata: charge.metadata,
        };
      }

      default:
        return null;
    }
  }
}
