import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import {
  CreateCompanyAccountDto,
  UpdateCompanyAccountDto,
} from './dto/company-account.dto.js';

@Injectable()
export class CompanyAccountsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  list(includeInactive = false) {
    return this.prisma.companyBankAccount.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ isActive: 'desc' }, { id: 'asc' }],
    });
  }

  async create(userId: number, dto: CreateCompanyAccountDto, ip?: string) {
    const account = await this.prisma.companyBankAccount.create({
      data: {
        bankName: dto.bankName.trim(),
        accountNumber: dto.accountNumber.trim(),
        accountName: dto.accountName.trim(),
        note: dto.note?.trim() || null,
      },
    });
    await this.auditService.logEvent({
      entityType: 'CompanyBankAccount',
      entityId: account.id,
      action: 'create_company_account',
      actorId: userId,
      afterJson: {
        bankName: account.bankName,
        accountNumber: account.accountNumber,
      },
      ip,
    });
    return account;
  }

  async update(
    userId: number,
    id: number,
    dto: UpdateCompanyAccountDto,
    ip?: string,
  ) {
    const existing = await this.prisma.companyBankAccount.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy tài khoản');
    const account = await this.prisma.companyBankAccount.update({
      where: { id },
      data: {
        ...(dto.bankName !== undefined ? { bankName: dto.bankName.trim() } : {}),
        ...(dto.accountNumber !== undefined
          ? { accountNumber: dto.accountNumber.trim() }
          : {}),
        ...(dto.accountName !== undefined
          ? { accountName: dto.accountName.trim() }
          : {}),
        ...(dto.note !== undefined ? { note: dto.note.trim() || null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    await this.auditService.logEvent({
      entityType: 'CompanyBankAccount',
      entityId: id,
      action: 'update_company_account',
      actorId: userId,
      beforeJson: {
        bankName: existing.bankName,
        accountNumber: existing.accountNumber,
        isActive: existing.isActive,
      },
      afterJson: {
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        isActive: account.isActive,
      },
      ip,
    });
    return account;
  }
}
