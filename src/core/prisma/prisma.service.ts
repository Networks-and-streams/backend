import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import databaseConfig from '@/config/loaders/database.config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(@Inject(databaseConfig.KEY) private readonly config: ConfigType<typeof databaseConfig>) {
    const adapter = new PrismaPg(
      new Pool({
        connectionString: config.url,
      }),
    );
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }
}
