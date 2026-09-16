import { Controller, Get, Headers, UnauthorizedException, HttpCode, HttpStatus } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';

/**
 * Endpoint nội bộ để Vercel Cron Jobs gọi định kỳ (thay cho @Cron trong
 * ReminderSchedulerService — không hoạt động trên serverless vì không có
 * tiến trình nền liên tục). Vercel Cron Jobs luôn gọi bằng GET. Bảo vệ bằng
 * CRON_SECRET (Vercel tự đính kèm header Authorization: Bearer $CRON_SECRET
 * khi biến môi trường này được cấu hình trên project) — không dùng
 * JwtAuthGuard vì đây không phải request của người dùng đăng nhập.
 */
@Controller('internal/cron')
export class CronController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('reminders')
  @HttpCode(HttpStatus.OK)
  async triggerReminders(@Headers('authorization') authHeader?: string) {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
      throw new UnauthorizedException('CRON_SECRET chưa được cấu hình trên server.');
    }
    if (authHeader !== `Bearer ${expected}`) {
      throw new UnauthorizedException('Không có quyền gọi endpoint nội bộ này.');
    }
    return this.notificationsService.triggerScheduledReminders();
  }
}
