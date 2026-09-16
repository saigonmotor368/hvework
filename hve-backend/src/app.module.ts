import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuditModule } from './audit/audit.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { AttachmentsModule } from './attachments/attachments.module.js';
import { WorkflowsModule } from './workflows/workflows.module.js';
import { AdminModule } from './admin/admin.module.js';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AuthModule,
    DocumentsModule,
    AttachmentsModule,
    WorkflowsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

