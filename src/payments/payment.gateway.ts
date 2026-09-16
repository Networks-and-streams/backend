import {
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
} from './payment.types';

/**
 * Provider-agnostic contract for payment service providers (PSPs).
 *
 * PaymentsService depends on this abstraction — never on a concrete
 * PSP implementation. Adding or replacing a provider means adding a new
 * `PaymentGateway` implementation, not rewriting the payment domain.
 */
export interface PaymentGateway {
  /**
   * Registers a payment intent/order with the PSP (if the provider
   * requires a server-side order before the client can pay).
   */
  createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResult>;

  /**
   * Submits a payment-method token (e.g. Google Pay tokenization data)
   * to the PSP and returns the processing result.
   */
  processGooglePay(request: ProcessGooglePayRequest): Promise<ProcessGooglePayResult>;

  /** Polls the PSP for the authoritative payment status. */
  verifyPayment(request: VerifyPaymentRequest): Promise<VerifyPaymentResult>;

  /** Requests a (partial) refund from the PSP. */
  refundPayment(request: RefundPaymentRequest): Promise<RefundPaymentResult>;

  /**
   * Validates a webhook delivery (signature/authentication) and parses
   * it into a normalized event. Must never trust an unverified payload.
   */
  verifyWebhook(request: VerifyWebhookRequest): Promise<VerifyWebhookResult>;
}

/**
 * Token for injecting a PaymentGateway implementation.
 * Use `{ provide: PAYMENT_GATEWAY, useClass: StripeGateway }` etc.
 */
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
