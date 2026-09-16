import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationsController } from './notifications.controller.js';
import { InAppChannel } from './channels/in-app.channel.js';
import { EmailChannel } from './channels/email.channel.js';
import { ZaloChannel } from './channels/zalo.channel.js';

import { WebPushService } from './web-push.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    WebPushService,
    InAppChannel,
    EmailChannel,
    ZaloChannel,
  ],
  exports: [NotificationsService, WebPushService],
})
export class NotificationsModule {}
