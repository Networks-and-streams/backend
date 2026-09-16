import { Provider } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtGuard } from '@/auth/guards/jwt.guard';
import { PrismaExceptionFilter } from './prisma/filters/prisma-exception.filter';

export const coreProviders: Provider[] = [
  {
    provide: APP_FILTER,
    useClass: PrismaExceptionFilter,
  },
  {
    provide: APP_GUARD,
    useClass: JwtGuard,
  },
  {
    provide: APP_GUARD,
    useClass: ThrottlerGuard,
  },
];
