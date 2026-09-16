import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel, NotificationPayload } from './notification-channel.interface.js';

@Injectable()
export class ZaloChannel implements NotificationChannel {
  channelName = 'zalo_oa';
  private readonly logger = new Logger(ZaloChannel.name);

  async send(payload: NotificationPayload): Promise<boolean> {
    // Stub interface mở sẵn chỗ cắm Zalo OA sau này
    this.logger.debug(
      `[ZALO OA STUB] Payload prepared for future Zalo OA integration: ${payload.title} to User #${payload.userId}`,
    );
    return true;
  }
}
