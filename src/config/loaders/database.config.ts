import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().optional(),
});

export default registerAs('database', () => {
  const env = databaseEnvSchema.parse(process.env);

  return {
    url: env.DATABASE_URL,
  };
});
