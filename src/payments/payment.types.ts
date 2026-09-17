import { PaymentStatus, SubscriptionPlan } from '@/generated/prisma/client';

/**
 * Trusted server-side plan pricing.
 * The client is never allowed to provide amount/currency — the backend
 * derives them from the plan via this configuration.
 */
export interface PlanPricing {
  plan: SubscriptionPlan;
  /** Amount in smallest currency unit (e.g. cents). */
  amount: number;
  currency: string;
}

export const PLAN_PRICING: Record<SubscriptionPlan, PlanPricing> = {
  [SubscriptionPlan.FREE]: { plan: SubscriptionPlan.FREE, amount: 0, currency: 'USD' },
  [SubscriptionPlan.PREMIUM]: { plan: SubscriptionPlan.PREMIUM, amount: 999, currency: 'USD' },
};

export function getPlanPricing(plan: SubscriptionPlan): PlanPricing {
  return PLAN_PRICING[plan];
}

/**
 * Valid payment state transitions. Any transition not listed here is rejected.
 */
export const PAYMENT_STATUS_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  [PaymentStatus.PENDING]: [
    PaymentStatus.PROCESSING,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
    PaymentStatus.SUCCEEDED,
  ],
  [PaymentStatus.PROCESSING]: [PaymentStatus.SUCCEEDED, PaymentStatus.FAILED, PaymentStatus.REFUNDED],
  [PaymentStatus.SUCCEEDED]: [PaymentStatus.REFUNDED],
  [PaymentStatus.FAILED]: [],
  [PaymentStatus.CANCELLED]: [],
  [PaymentStatus.REFUNDED]: [],
};

/** Terminal states — no further transitions allowed. */
export const TERMINAL_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.SUCCEEDED,
  PaymentStatus.FAILED,
  PaymentStatus.CANCELLED,
  PaymentStatus.REFUNDED,
];

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminalPaymentStatus(status: PaymentStatus): boolean {
  return TERMINAL_PAYMENT_STATUSES.includes(status);
}

/**
 * Maps a normalized PSP webhook status onto the internal payment status.
 * Unknown statuses map to `undefined` (handled by the caller).
 */
export const WEBHOOK_STATUS_TO_PAYMENT_STATUS: Record<WebhookPaymentStatus, PaymentStatus | undefined> = {
  succeeded: PaymentStatus.SUCCEEDED,
  processing: PaymentStatus.PROCESSING,
  failed: PaymentStatus.FAILED,
  refunded: PaymentStatus.REFUNDED,
  pending: PaymentStatus.PENDING,
};

/* ------------------------------------------------------------------ */
/* PaymentGateway contract                                             */
/* ------------------------------------------------------------------ */

export interface CreatePaymentRequest {
  userId: string;
  plan: SubscriptionPlan;
  amount: number;
  currency: string;
}

export interface CreatePaymentResult {
  providerPaymentId?: string;
  clientSecret?: string;
  metadata?: Record<string, unknown>;
}

export interface ProcessGooglePayRequest {
  /** Internal payment id. */
  paymentId: string;
  userId: string;
  subscriptionId?: string | null;
  plan: SubscriptionPlan;
  amount: number;
  currency: string;
  /** Payment-method-specific token payload (Google Pay tokenization data). */
  tokenData: Record<string, unknown>;
}

export interface ProcessGooglePayResult {
  /** PSP payment reference (if returned). */
  providerPaymentId?: string;
  status: 'succeeded' | 'processing' | 'failed';
  failureReason?: string;
  metadata?: Record<string, unknown>;
}

export interface VerifyPaymentRequest {
  providerPaymentId: string;
}

export interface VerifyPaymentResult {
  status: 'succeeded' | 'failed' | 'processing' | 'pending';
  metadata?: Record<string, unknown>;
}

export interface RefundPaymentRequest {
  providerPaymentId: string;
  amount?: number;
  reason?: string;
}

export interface RefundPaymentResult {
  refunded: boolean;
  refundId?: string;
}

export type WebhookPaymentStatus = 'succeeded' | 'failed' | 'processing' | 'refunded' | 'pending';

export interface WebhookEvent {
  type: string;
  /** PSP's unique event identifier (e.g. Stripe's evt_...). Used for persistent idempotency. */
  eventId?: string;
  providerPaymentId: string;
  status: WebhookPaymentStatus;
  metadata?: Record<string, unknown>;
}

export interface VerifyWebhookRequest {
  /** Raw request headers — used for signature verification. */
  headers: Record<string, string>;
  /**
   * Raw webhook payload.
   *
   * For providers that verify signatures over the raw bytes (e.g. Stripe),
   * this must be the raw body Buffer, not the parsed JSON.
   */
  body: unknown;
}

export interface VerifyWebhookResult {
  valid: boolean;
  event?: WebhookEvent;
}
