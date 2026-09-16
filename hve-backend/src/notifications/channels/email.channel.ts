import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel, NotificationPayload } from './notification-channel.interface.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class EmailChannel implements NotificationChannel {
  channelName = 'email';
  private readonly logger = new Logger(EmailChannel.name);

  constructor(private prisma: PrismaService) {}

  async send(payload: NotificationPayload): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: { email: true, name: true },
      });

      if (!user || !user.email) {
        return false;
      }

      // Mô phỏng / Gửi email với format chuẩn của Huy Vo Education
      this.logger.log(
        `[EMAIL DISPATCH] To: ${user.name} <${user.email}> | Subject: [HVE Work] ${payload.title} | Content: ${payload.content} | Link: ${payload.link || 'N/A'}`,
      );

      return true;
    } catch (err: any) {
      this.logger.error(`Failed to send email notification: ${err.message}`);
      return false;
    }
  }
}
