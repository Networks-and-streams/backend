import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Ascora API')
    .setDescription('API documentation for Ascora application')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'JWT-auth',
    )
    .addGlobalParameters({
      name: 'Accept-Language',
      in: 'header',
      required: false,
      schema: {
        type: 'string',
        default: 'en',
        enum: ['en', 'uk', 'ru'],
      },
      description: 'Preferred language for localized responses',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs/openapi', app, document);
}
