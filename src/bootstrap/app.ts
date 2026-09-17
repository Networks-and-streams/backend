import { NestFactory } from '@nestjs/core';
import { ConsoleLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import express from 'express';
import type { Request } from 'express';

import { AppModule } from '../app.module';
import { setupCors } from './setup-cors';
import { setupPipes } from './setup-pipes';
import { setupInterceptors } from './setup-interceptors';
import { setupSwagger } from './setup-swagger';

export async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Disable default parsers so we can capture the raw webhook body.
    logger: new ConsoleLogger({}),
  });

  // Body parsing with raw-body capture for the Stripe webhook route.
  // Stripe's signature verification (constructEvent) requires the raw bytes;
  // NestJS's plain JSON parser would replace them with a parsed object.
  app.use(
    express.json({
      verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
        if (req.url === '/payments/webhook') {
          req.rawBody = buf;
        }
      },
    }),
  );

  const configService = app.get(ConfigService);

  app.use(cookieParser());

  setupCors(app, configService);
  setupPipes(app);
  setupInterceptors(app);
  setupSwagger(app);

  await app.listen(configService.getOrThrow<number>('app.port'));
}
