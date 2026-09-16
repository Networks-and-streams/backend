import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const jwtEnvSchema = z.object({
  JWT_SECRET: z.string({ error: 'JWT_SECRET is required' }).min(8, 'JWT_SECRET must be at least 32 characters long'),
  JWT_ACCESS_TOKEN_TTL: z.string({ error: 'JWT_ACCESS_TOKEN_TTL is required' }).default('15m'),
  JWT_REFRESH_SECRET: z
    .string({ error: 'JWT_REFRESH_SECRET is required' })
    .min(8, 'JWT_REFRESH_SECRET must be at least 32 characters long'),
  JWT_REFRESH_TOKEN_TTL: z.string({ error: 'JWT_REFRESH_TOKEN_TTL is required' }).default('7d'),
});

export default registerAs('jwt', () => {
  const env = jwtEnvSchema.parse(process.env);

  return {
    secret: env.JWT_SECRET,
    accessTokenTtl: env.JWT_ACCESS_TOKEN_TTL,
    refreshSecret: env.JWT_REFRESH_SECRET,
    refreshTokenTtl: env.JWT_REFRESH_TOKEN_TTL,
  };
});
