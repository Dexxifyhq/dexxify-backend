import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import compression from 'compression';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
    rawBody: true,
  });

  const configService = app.get(ConfigService);

  // Cookie parser — required for http-only cookie auth
  app.use(cookieParser());

  // Performance: Compression
  app.use(compression());

  // Global prefix
  const apiPrefix = configService.get('app.apiPrefix');
  app.setGlobalPrefix(apiPrefix);

  // Security
  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(','),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // required for cookies to be sent cross-origin
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger / OpenAPI docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Dexxify Africa API')
    .setDescription(
      'Crypto Infrastructure API for Africa (Wallets, Payouts, Offramp, Onramp, KYC, KYB)',
    )
    .setVersion('1.0')
    .setContact('Dexxify', 'https://www.dexxify.com', 'dexxifyhq@gmail.com')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        description: 'API key for /v1/* endpoints',
      },
      'api-key',
    )
    .addCookieAuth(
      'access_token',
      {
        type: 'apiKey',
        in: 'cookie',
        description: 'HTTP-only cookie for dashboard/auth',
      },
      'cookie-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`💵 Dexxify API running on port ${port}`);
  logger.log(`📄 Swagger docs available at http://localhost:${port}/docs`);
}
bootstrap();
