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
} from '../../payment.types';
import type { PaymentGateway } from '../../payment.gateway';

/**
 * In-memory PaymentGateway used when `PAYMENTS_TEST_MODE` is enabled
 * (expansion plan §5.7 — manual QA of the desktop build).
 *
 * Every payment succeeds immediately and locally: no network calls, no
 * credentials, no external account. The `PaymentsService` flow is completely
 * unchanged (atomic claim → gateway → SUCCEEDED → subscription activation),
 * so a test purchase exercises exactly the code path a real purchase takes.
 *
 * Deliberately NOT a production integration: `payment-gateway.factory.ts`
 * only selects it when the explicit `PAYMENTS_TEST_MODE` flag is on, and the
 * flag defaults to off for every non-desktop deployment.
 */
export class TestPaymentGateway implements PaymentGateway {
  /** Provider reference used for test payments (`test_<paymentId>`). */
  static readonly providerPaymentIdPrefix = 'test_';

  createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResult> {
    return Promise.resolve({
      providerPaymentId: `${TestPaymentGateway.providerPaymentIdPrefix}order_${request.userId}_${request.plan}`,
      metadata: { testMode: true },
    });
  }

  /**
   * Completes the payment successfully. The token payload is a placeholder —
   * the test gateway never inspects it (the frontend sends `{ type: 'TEST',
   * token: 'test-mode' }` from the "Test purchase" button).
   */
  processGooglePay(request: ProcessGooglePayRequest): Promise<ProcessGooglePayResult> {
    return Promise.resolve({
      status: 'succeeded',
      providerPaymentId: `${TestPaymentGateway.providerPaymentIdPrefix}${request.paymentId}`,
      metadata: {
        testMode: true,
        plan: request.plan,
        amount: request.amount,
        currency: request.currency,
      },
    });
  }

  /**
   * Nothing can fail in test mode, so any payment that reached the provider
   * (e.g. a purchase interrupted by an app restart) reads back as succeeded —
   * the desktop reconcile-on-read then activates the subscription.
   */
  verifyPayment(request: VerifyPaymentRequest): Promise<VerifyPaymentResult> {
    return Promise.resolve({
      status: 'succeeded',
      metadata: { testMode: true, providerPaymentId: request.providerPaymentId },
    });
  }

  refundPayment(request: RefundPaymentRequest): Promise<RefundPaymentResult> {
    return Promise.resolve({
      refunded: true,
      refundId: `${TestPaymentGateway.providerPaymentIdPrefix}refund_${request.providerPaymentId}`,
    });
  }

  /**
   * Test mode has no PSP, therefore no webhook deliveries exist — every
   * payload is rejected so an unverified request can never move a payment.
   */
  verifyWebhook(_request: VerifyWebhookRequest): Promise<VerifyWebhookResult> {
    return Promise.resolve({ valid: false });
  }
}
