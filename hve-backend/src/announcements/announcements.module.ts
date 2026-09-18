import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import {
  AdminAnnouncementsController,
  AnnouncementsController,
} from './announcements.controller.js';
import { AnnouncementsService } from './announcements.service.js';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule],
  controllers: [AnnouncementsController, AdminAnnouncementsController],
  providers: [AnnouncementsService],
})
export class AnnouncementsModule {}
