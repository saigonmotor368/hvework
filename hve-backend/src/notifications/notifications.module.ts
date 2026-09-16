import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationsController } from './notifications.controller.js';
import { CronController } from './cron.controller.js';
import { InAppChannel } from './channels/in-app.channel.js';
import { EmailChannel } from './channels/email.channel.js';
import { ZaloChannel } from './channels/zalo.channel.js';

import { WebPushService } from './web-push.service.js';
import { ReminderSchedulerService } from './reminder-scheduler.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [NotificationsController, CronController],
  providers: [
    NotificationsService,
    WebPushService,
    InAppChannel,
    EmailChannel,
    ZaloChannel,
    ReminderSchedulerService,
  ],
  exports: [NotificationsService, WebPushService],
})
export class NotificationsModule {}
