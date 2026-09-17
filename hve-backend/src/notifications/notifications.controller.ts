import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { NotificationsService } from './notifications.service.js';
import { WebPushService } from './web-push.service.js';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly webPushService: WebPushService,
  ) {}

  @Get('vapid-public-key')
  getVapidPublicKey() {
    return { publicKey: this.webPushService.getPublicKey() };
  }

  @Post('push-subscribe')
  @HttpCode(HttpStatus.OK)
  async subscribePush(@Body() body: any, @Req() req: any) {
    await this.webPushService.saveSubscription(req.user.id, body);
    return { success: true };
  }

  @Get()
  async getNotifications(
    @Req() req: any,
    @Query('isUnreadOnly') isUnreadOnly?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.getUserNotifications(req.user.id, {
      isUnreadOnly,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(@Req() req: any) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    return this.notificationsService.markAsRead(req.user.id, id);
  }

  @Post('trigger-reminders')
  @HttpCode(HttpStatus.OK)
  async triggerReminders() {
    return this.notificationsService.triggerScheduledReminders();
  }
}
