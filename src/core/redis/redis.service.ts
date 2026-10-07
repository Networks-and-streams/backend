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

  /**
   * Atomically increments a counter and returns the new value. The TTL is set
   * only when the key has none yet, so repeated increments never extend it.
   */
  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const [value] = await this.client.multi().incr(key).expire(key, ttlSeconds, 'NX').exec();
    return Number(value);
  }

  /** Reads and deletes a key atomically (single-use values such as tokens). */
  async getDel(key: string): Promise<string | null> {
    return this.client.getDel(key);
  }

  async decr(key: string): Promise<number> {
    return this.client.decr(key);
  }
}
