import { PrismaClient } from '@/generated/prisma/client';

export interface SeedContext {
  prisma: PrismaClient;
}
