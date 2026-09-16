import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel, NotificationPayload } from './notification-channel.interface.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class InAppChannel implements NotificationChannel {
  channelName = 'in_app';
  private readonly logger = new Logger(InAppChannel.name);

  constructor(private prisma: PrismaService) {}

  async send(payload: NotificationPayload): Promise<boolean> {
    try {
      await this.prisma.notification.create({
        data: {
          userId: payload.userId,
          eventType: payload.eventType,
          entityRef: payload.entityRef,
          title: payload.title,
          content: payload.content,
          link: payload.link,
          channel: 'in_app',
          dedupeKey: payload.dedupeKey,
        },
      });
      return true;
    } catch (err: any) {
      // Nếu vi phạm unique dedupeKey, coi như đã gửi thông báo mốc này -> bỏ qua an toàn
      if (err?.code === 'P2002') {
        this.logger.debug(`[DEDUPE] Notification already sent with dedupeKey: ${payload.dedupeKey}`);
        return false;
      }
      this.logger.error(`Failed to create in-app notification: ${err.message}`);
      return false;
    }
  }
}
