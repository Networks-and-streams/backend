import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const paymentEnvSchema = z.object({
  PAYMENT_CURRENCY: z.string({ error: 'PAYMENT_CURRENCY is required' }).default('USD'),
  PAYMENT_WEBHOOK_SECRET: z
    .string({ error: 'PAYMENT_WEBHOOK_SECRET is required' })
    .min(16, 'PAYMENT_WEBHOOK_SECRET must be at least 16 characters long'),
  PAYMENT_PROVIDER: z.enum(['stripe', 'liqpay', 'wayforpay']).default('stripe'),

  // PSP credentials. Optional at the schema level: they are only enforced
  // below when a real payment provider is used — PAYMENTS_TEST_MODE runs
  // without any of them (manual QA on a machine with no Stripe account).
  GOOGLE_PAY_MER_ID: z.string().optional(),

  // Stripe-specific
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_API_VERSION: z.string().optional(),

  /**
   * Manual-testing switch (expansion plan §5.7): when enabled, payments are
   * completed by the local test gateway WITHOUT contacting a real payment
   * service provider, so the whole purchase flow can be exercised on a
   * desktop install. Off by default — the desktop build turns it on until
   * real Stripe credentials are pasted into its config.json.
   */
  PAYMENTS_TEST_MODE: z.string().optional(),
});

/** Truthy env spellings; anything else (unset/'false'/'0') means "off". */
function isFlagEnabled(value: string | undefined): boolean {
  if (!value) return false;
  return ['true', '1', 'yes'].includes(value.trim().toLowerCase());
}

function requireWhenNotTesting(value: string | undefined, name: string): void {
  if (!value) {
    throw new Error(`${name} is required unless PAYMENTS_TEST_MODE is enabled`);
  }
}

export default registerAs('payment', () => {
  const env = paymentEnvSchema.parse(process.env);
  const testMode = isFlagEnabled(env.PAYMENTS_TEST_MODE);

  // A real PSP needs its credentials; the local test gateway needs none.
  if (!testMode) {
    requireWhenNotTesting(env.GOOGLE_PAY_MER_ID, 'GOOGLE_PAY_MER_ID');
    requireWhenNotTesting(env.STRIPE_SECRET_KEY, 'STRIPE_SECRET_KEY');
    requireWhenNotTesting(env.STRIPE_WEBHOOK_SECRET, 'STRIPE_WEBHOOK_SECRET');
  }

  return {
    provider: env.PAYMENT_PROVIDER,
    defaultCurrency: env.PAYMENT_CURRENCY,
    webhookSecret: env.PAYMENT_WEBHOOK_SECRET,
    googlePayMerchantId: env.GOOGLE_PAY_MER_ID ?? '',

    // Stripe
    stripeSecretKey: env.STRIPE_SECRET_KEY ?? '',
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET ?? '',
    stripeApiVersion: env.STRIPE_API_VERSION,

    /** True when the local test gateway must replace the real PSP. */
    testMode,
  };
});
