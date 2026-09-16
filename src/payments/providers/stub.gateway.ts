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
} from '../payment.types';
import { PaymentGateway } from '../payment.gateway';

/**
 * Placeholder gateway used until a real payment service provider is configured.
 *
 * This is deliberately NOT a production integration — it fails loudly so a
 * misconfigured deployment can never silently accept payments. Replace it by
 * providing your own `PaymentGateway` implementation for `PAYMENT_GATEWAY`
 * (e.g. StripeGateway, LiqPayGateway, WayForPayGateway).
 */
export class StubPaymentGateway implements PaymentGateway {
  createPayment(_request: CreatePaymentRequest): Promise<CreatePaymentResult> {
    return this.notConfigured('createPayment');
  }

  processGooglePay(_request: ProcessGooglePayRequest): Promise<ProcessGooglePayResult> {
    return this.notConfigured('processGooglePay');
  }

  verifyPayment(_request: VerifyPaymentRequest): Promise<VerifyPaymentResult> {
    return this.notConfigured('verifyPayment');
  }

  refundPayment(_request: RefundPaymentRequest): Promise<RefundPaymentResult> {
    return this.notConfigured('refundPayment');
  }

  verifyWebhook(_request: VerifyWebhookRequest): Promise<VerifyWebhookResult> {
    return this.notConfigured('verifyWebhook');
  }

  private notConfigured(method: string): never {
    throw new Error(
      `PaymentGateway.${method} is not configured. ` +
        'Provide a real PaymentGateway implementation for the PAYMENT_GATEWAY token ' +
        '(see src/payments/providers/).',
    );
  }
}
