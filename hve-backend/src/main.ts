import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
import * as fs from 'fs';
import { AppModule } from './app.module.js';

import helmet from 'helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const uploadDir = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Security Headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: false, // Ensure Swagger UI and font resources load smoothly
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Strict CORS Whitelist
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS policy'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // OpenAPI / Swagger Documentation with Basic Auth Protection
  const swaggerUser = process.env.SWAGGER_USER || 'admin';
  const swaggerPassword =
    process.env.SWAGGER_PASSWORD ||
    (process.env.NODE_ENV === 'production' ? null : 'HVE_Swagger_Pass_2026!');

  app.use(
    ['/api/docs', '/api/docs-json', '/api/docs-yaml'],
    (req: any, res: any, next: any) => {
      if (!swaggerPassword) {
        return res
          .status(403)
          .send(
            'Swagger documentation is disabled in production without SWAGGER_PASSWORD configured.',
          );
      }

      const authHeader = req.headers['authorization'];
      if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic realm="HVE Work API Docs"');
        return res
          .status(401)
          .send('Authentication required to access API documentation');
      }

      const [type, token] = authHeader.split(' ');
      if (type !== 'Basic' || !token) {
        res.setHeader('WWW-Authenticate', 'Basic realm="HVE Work API Docs"');
        return res.status(401).send('Invalid authorization format');
      }

      const credentials = Buffer.from(token, 'base64')
        .toString('utf8')
        .split(':');
      const user = credentials[0];
      const pass = credentials.slice(1).join(':');

      if (user === swaggerUser && pass === swaggerPassword) {
        return next();
      }

      res.setHeader('WWW-Authenticate', 'Basic realm="HVE Work API Docs"');
      return res.status(401).send('Access denied: Invalid credentials');
    },
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('HVE Work API')
    .setDescription('Tài liệu API Hệ thống Quản lý Điều hành & Phê duyệt HVE Work (Huy Võ Education)')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();

