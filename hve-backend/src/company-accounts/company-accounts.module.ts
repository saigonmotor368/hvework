import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { CompanyAccountsController } from './company-accounts.controller.js';
import { CompanyAccountsService } from './company-accounts.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CompanyAccountsController],
  providers: [CompanyAccountsService],
  exports: [CompanyAccountsService],
})
export class CompanyAccountsModule {}
