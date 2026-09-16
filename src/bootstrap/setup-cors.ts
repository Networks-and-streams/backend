import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export function setupCors(app: INestApplication, configService: ConfigService): void {
  const origins = configService.getOrThrow<string[]>('cors.origins');

  app.enableCors({
    origin: origins,
    credentials: true,
  });
}
