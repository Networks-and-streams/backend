import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const appEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Empty string = host-only cookie (no Domain attribute). This is what the
  // local tunnel needs: frontend and API share one public origin, and a
  // Domain cookie (e.g. Domain=localhost) would be rejected by the browser
  // for any other host. Production deployments set this to their real domain.
  COOKIE_DOMAIN: z.string().default(''),

  COOKIE_SECURE: z.coerce.boolean().default(false),

  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),

  FRONTEND_URL: z.url({ error: 'FRONTEND_URL must be a valid URL' }),

  PORT: z.coerce.number().int().positive().default(3000),
});

export default registerAs('app', () => {
  const env = appEnvSchema.parse(process.env);

  return {
    nodeEnv: env.NODE_ENV,

    cookieDomain: env.COOKIE_DOMAIN,
    cookieSecure: env.COOKIE_SECURE,
    cookieSameSite: env.COOKIE_SAME_SITE,

    frontendUrl: env.FRONTEND_URL,
    port: env.PORT,
  };
});
