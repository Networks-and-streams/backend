import path from 'node:path';
import { config as loadEnv } from 'dotenv';

// Load backend/.env first (dotenv never overrides already-set vars).
loadEnv({ path: path.resolve(__dirname, '../.env') });

// E2E must never touch the development database: prefer TEST_DATABASE_URL.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
