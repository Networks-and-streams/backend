import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { ClsModule } from 'nestjs-cls';

import { PrismaModule } from './prisma/prisma.module';

import { clsModuleConfig, throttlerConfig } from './core.config';
import { coreProviders } from './core.providers';
import { RedisModule } from './redis/redis.module';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    PassportModule,
    PrismaModule,
    RedisModule,
    EventEmitterModule.forRoot(),
    ClsModule.forRoot(clsModuleConfig),
    ThrottlerModule.forRoot(throttlerConfig),
  ],
  providers: coreProviders,
})
export class CoreModule {}
