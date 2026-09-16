import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { RequestHandler } from 'express';
import * as helmetImport from 'helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

// helmet khai báo export dạng dual-package (ESM .mjs / CJS .cjs) — tuỳ môi
// trường build (Windows local vs Linux trên Vercel) mà TypeScript đôi khi
// resolve nhầm sang bản không có call signature dù lúc chạy thực tế luôn
// đúng. Ép kiểu tường minh 1 lần ở đây để tránh phụ thuộc vào resolution
// không ổn định giữa các môi trường.
const helmet = (helmetImport as unknown as { default: (options?: Record<string, unknown>) => RequestHandler })
  .default;

/**
 * Cấu hình app dùng chung cho cả 2 chế độ chạy: server truyền thống
 * (main.ts, app.listen) và Vercel serverless (api/index.ts, không listen).
 */
export function configureApp(app: NestExpressApplication) {
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
}
