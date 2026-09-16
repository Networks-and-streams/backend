import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const corsEnvSchema = z.object({
  CORS_ORIGINS: z
    .string({ error: 'CORS_ORIGINS environment variable is required' })
    .min(1, 'CORS_ORIGINS cannot be empty')
    .transform((val) =>
      val
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
});

export default registerAs('cors', () => {
  const env = corsEnvSchema.parse(process.env);

  return {
    origins: env.CORS_ORIGINS,
  };
});
