import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const redisEnvSchema = z.object({
  REDIS_URL: z.string().optional(),
});

export default registerAs('redis', () => {
  const env = redisEnvSchema.parse(process.env);

  return {
    url: env.REDIS_URL,
  };
});
