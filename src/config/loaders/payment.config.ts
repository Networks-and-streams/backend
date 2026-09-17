import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const paymentEnvSchema = z.object({
  PAYMENT_CURRENCY: z.string({ error: 'PAYMENT_CURRENCY is required' }).default('USD'),
  PAYMENT_WEBHOOK_SECRET: z
    .string({ error: 'PAYMENT_WEBHOOK_SECRET is required' })
    .min(16, 'PAYMENT_WEBHOOK_SECRET must be at least 16 characters long'),
  PAYMENT_PROVIDER: z.enum(['stripe', 'liqpay', 'wayforpay']).default('stripe'),
  GOOGLE_PAY_MER_ID: z.string({ error: 'GOOGLE_PAY_MER_ID is required' }).min(1, 'GOOGLE_PAY_MER_ID cannot be empty'),

  // Stripe-specific
  STRIPE_SECRET_KEY: z
    .string({ error: 'STRIPE_SECRET_KEY is required when using Stripe' })
    .min(1, 'STRIPE_SECRET_KEY cannot be empty'),
  STRIPE_WEBHOOK_SECRET: z
    .string({ error: 'STRIPE_WEBHOOK_SECRET is required when using Stripe' })
    .min(1, 'STRIPE_WEBHOOK_SECRET cannot be empty'),
  STRIPE_API_VERSION: z.string().optional(),
});

export default registerAs('payment', () => {
  const env = paymentEnvSchema.parse(process.env);

  return {
    provider: env.PAYMENT_PROVIDER,
    defaultCurrency: env.PAYMENT_CURRENCY,
    webhookSecret: env.PAYMENT_WEBHOOK_SECRET,
    googlePayMerchantId: env.GOOGLE_PAY_MER_ID,

    // Stripe
    stripeSecretKey: env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
    stripeApiVersion: env.STRIPE_API_VERSION,
  };
});
