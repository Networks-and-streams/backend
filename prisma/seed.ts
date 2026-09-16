import 'dotenv/config';
import { env } from 'prisma/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

import type { SeedContext } from './seed-context';
import { seedExercise } from './seeds/exercise';

const connectionString = env('DATABASE_URL');
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const ctx: SeedContext = {
    prisma,
  };

  await seedExercise(ctx);
}
main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
