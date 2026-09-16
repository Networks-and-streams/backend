import { NestFactory } from '@nestjs/core';
import { ConsoleLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';

import { AppModule } from '../app.module';
import { setupCors } from './setup-cors';
import { setupPipes } from './setup-pipes';
import { setupInterceptors } from './setup-interceptors';
import { setupSwagger } from './setup-swagger';

export async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({}),
  });

  const configService = app.get(ConfigService);

  app.use(cookieParser());

  setupCors(app, configService);
  setupPipes(app);
  setupInterceptors(app);
  setupSwagger(app);

  await app.listen(configService.getOrThrow<number>('app.port'));
}
