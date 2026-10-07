import { registerAs } from '@nestjs/config';
import { z } from 'zod';

/**
 * SMTP settings. All optional: without SMTP_HOST no mail is sent and the
 * links are written to the log instead (enough for local development).
 */
const mailEnvSchema = z.object({
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  // true = TLS from the start (port 465); false = STARTTLS upgrade (587).
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('Graph Resolver <no-reply@localhost>'),
});

export default registerAs('mail', () => {
  const env = mailEnvSchema.parse(process.env);
  return {
    host: env.SMTP_HOST || undefined,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER || undefined,
    pass: env.SMTP_PASS || undefined,
    from: env.MAIL_FROM,
  };
});
