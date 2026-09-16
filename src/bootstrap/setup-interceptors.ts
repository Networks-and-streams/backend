import { ClassSerializerInterceptor, INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export function setupInterceptors(app: INestApplication) {
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
}
