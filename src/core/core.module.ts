import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { ClsModule } from 'nestjs-cls';

import { PrismaModule } from './prisma/prisma.module';

import { clsModuleConfig, throttlerConfig } from './core.config';
import { coreProviders } from './core.providers';
import { RedisModule } from './redis/redis.module';
import { ThrottlerModule } from '@nestjs/throttler';

/**
 * Redis is currently unused by any feature module — the desktop build runs
 * without it (`REDIS_ENABLED=false`), so the module (and its `onModuleInit`
 * connect) is skipped entirely. Dev/Docker keep the previous behaviour:
 * anything but an explicit `false` registers Redis as before.
 */
const redisImports = process.env.REDIS_ENABLED === 'false' ? [] : [RedisModule];

@Module({
  imports: [
    PassportModule,
    PrismaModule,
    ...redisImports,
    EventEmitterModule.forRoot(),
    ClsModule.forRoot(clsModuleConfig),
    ThrottlerModule.forRoot(throttlerConfig),
  ],
  providers: coreProviders,
})
export class CoreModule {}
