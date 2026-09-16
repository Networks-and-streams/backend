import { registerAs } from '@nestjs/config';

export default registerAs('crypto', () => ({
  // 32-byte hex key used to encrypt sensitive credentials at rest (e.g. OAuth refresh tokens).
  credentialsKey: process.env.CREDENTIALS_ENCRYPTION_KEY!,
}));
