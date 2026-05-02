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

  // CORS
  const allowedOrigins =
    process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()) || [];
  // console.log('allowedOrigins', allowedOrigins);
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
    maxAge: 3600, // Cache preflight for 1 hour
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
    .setTitle('Dexxify API')
    .setDescription(
      'Crypto Infrastructure API for Africa (Wallets, Payouts, Offramp, Onramp, KYC, KYB)',
    )
    .setVersion('1.0')
    .setContact('Dexxify', 'https://www.dexxify.com', 'dexxifyhq@gmail.com')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        in: 'header',
        description: 'API key for /v1/* endpoints',
      },
      'api-key',
    )
    // .addCookieAuth(
    //   'access_token',
    //   {
    //     type: 'apiKey',
    //     in: 'cookie',
    //     description: 'HTTP-only cookie for dashboard/auth',
    //   },
    //   'cookie-auth',
    // )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`💵 Dexxify API running on port ${port}`);
  logger.log(`📄 Swagger docs available at http://localhost:${port}/api`);
}
bootstrap();
