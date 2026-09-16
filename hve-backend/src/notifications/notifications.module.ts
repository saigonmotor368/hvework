import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationsController } from './notifications.controller.js';
import { InAppChannel } from './channels/in-app.channel.js';
import { EmailChannel } from './channels/email.channel.js';
import { ZaloChannel } from './channels/zalo.channel.js';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    InAppChannel,
    EmailChannel,
    ZaloChannel,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
