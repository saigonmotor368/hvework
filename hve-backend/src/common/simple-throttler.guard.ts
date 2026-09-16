import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { THROTTLE_LIMIT_KEY, THROTTLE_TTL_KEY } from './throttle.decorator.js';

const DEFAULT_LIMIT = 1000; // Trần an toàn chung, tránh cả văn phòng dùng chung 1 IP bị chặn
const DEFAULT_TTL_MS = 60000;

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Rate limit đơn giản theo IP + route, lưu trong bộ nhớ tiến trình. Thay
 * thế @nestjs/throttler (xem ghi chú trong throttle.decorator.ts). Lưu ý:
 * trên môi trường serverless, bộ đếm này không dùng chung được giữa các
 * instance khác nhau — chỉ là lớp bảo vệ cơ bản, không phải rate limit
 * phân tán chính xác tuyệt đối (muốn vậy cần Redis/Upstash).
 */
@Injectable()
export class SimpleThrottlerGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const limit =
      this.reflector.getAllAndOverride<number>(THROTTLE_LIMIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT_LIMIT;
    const ttlMs =
      this.reflector.getAllAndOverride<number>(THROTTLE_TTL_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT_TTL_MS;

    const request = context.switchToHttp().getRequest();
    const ip = request.ip || request.headers?.['x-forwarded-for'] || 'unknown';
    const key = `${request.method}:${request.route?.path || request.url}:${ip}`;

    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + ttlMs });
      return true;
    }

    if (bucket.count >= limit) {
      throw new HttpException(
        'Bạn đã thao tác quá nhiều lần trong thời gian ngắn. Vui lòng thử lại sau ít phút.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    bucket.count += 1;
    return true;
  }
}
