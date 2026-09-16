import { Module } from '@nestjs/common';
import { AttachmentsService } from './attachments.service.js';
import { AttachmentsController } from './attachments.controller.js';
import { GoogleDriveService } from './google-drive.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, GoogleDriveService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
