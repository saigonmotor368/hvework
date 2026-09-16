import { SetMetadata } from '@nestjs/common';

export const THROTTLE_LIMIT_KEY = 'throttle_limit';
export const THROTTLE_TTL_KEY = 'throttle_ttl';

/**
 * Giới hạn số lần gọi endpoint theo IP trong 1 khoảng thời gian. Thay thế
 * @nestjs/throttler — gói này biên dịch ra CommonJS require() thẳng
 * @nestjs/common (ESM thuần từ NestJS 12), không chạy được trên môi trường
 * serverless của Vercel (lỗi ERR_REQUIRE_ESM), dù chạy bình thường ở máy
 * local có Node hỗ trợ require() đồng bộ 1 module ESM.
 */
export const Throttle = (limit: number, ttlMs: number) => {
  return (target: object, key?: string | symbol, descriptor?: PropertyDescriptor) => {
    SetMetadata(THROTTLE_LIMIT_KEY, limit)(target, key as string, descriptor as PropertyDescriptor);
    SetMetadata(THROTTLE_TTL_KEY, ttlMs)(target, key as string, descriptor as PropertyDescriptor);
  };
};
