import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const googleEnvSchema = z.object({
  GOOGLE_CLIENT_ID: z.string({ error: 'GOOGLE_CLIENT_ID is required' }).min(1, 'GOOGLE_CLIENT_ID cannot be empty'),
  GOOGLE_CLIENT_SECRET: z
    .string({ error: 'GOOGLE_CLIENT_SECRET is required' })
    .min(1, 'GOOGLE_CLIENT_SECRET cannot be empty'),
  GOOGLE_CALLBACK_URL: z.url({ error: 'GOOGLE_CALLBACK_URL must be a valid URL' }),
});

export default registerAs('google', () => {
  const env = googleEnvSchema.parse(process.env);

  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackUrl: env.GOOGLE_CALLBACK_URL,
  };
});
