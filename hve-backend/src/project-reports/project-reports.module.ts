import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ProjectReportsController } from './project-reports.controller.js';
import { ProjectReportsService } from './project-reports.service.js';

@Module({
  imports: [PrismaModule, AuditModule, AuthModule, NotificationsModule],
  controllers: [ProjectReportsController],
  providers: [ProjectReportsService],
  exports: [ProjectReportsService],
})
export class ProjectReportsModule {}
