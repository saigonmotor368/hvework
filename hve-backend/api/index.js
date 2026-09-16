// Entry point cho Vercel Serverless Functions. Viết bằng JS thuần (không
// phải .ts) và chỉ import từ dist/ (đã biên dịch qua `nest build`/tsc) —
// KHÔNG import trực tiếp từ src/*.ts. NestJS dựa vào emitDecoratorMetadata
// của tsc để Dependency Injection hoạt động đúng; nếu để Vercel/esbuild
// transpile TypeScript có decorator ngay lúc chạy (thay vì build trước bằng
// tsc), một số class DI (ví dụ ThrottlerGuard cần Reflector) sẽ bị nhận
// diện sai class reference và app crash ngay khi khởi động với lỗi khó hiểu
// kiểu "Nest can't resolve dependencies of X" dù code hoàn toàn đúng.
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from '../dist/app.module.js';
import { configureApp } from '../dist/bootstrap.js';

let cachedApp = null;

async function getApp() {
  if (cachedApp) {
    return cachedApp;
  }

  const expressApp = express();
  const nestApp = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
  configureApp(nestApp);
  await nestApp.init();

  cachedApp = expressApp;
  return expressApp;
}

export default async function handler(req, res) {
  const app = await getApp();
  app(req, res);
}
