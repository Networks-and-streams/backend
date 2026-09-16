import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import type { ConfigType } from '@nestjs/config';
import redisConfig from '@/config/loaders/redis.config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType;

  constructor(@Inject(redisConfig.KEY) private readonly config: ConfigType<typeof redisConfig>) {
    this.client = createClient({
      url: config.url,
    });

    this.client.on('error', (err) => this.logger.error('Redis Client Error', err));
  }

  async onModuleInit() {
    await this.client.connect();
    this.logger.log('Redis connected successfully');
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, { EX: ttlSeconds });
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}
