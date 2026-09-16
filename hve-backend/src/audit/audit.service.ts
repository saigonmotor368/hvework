import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async logEvent(data: {
    entityType: string;
    entityId?: number;
    action: string;
    actorId?: number;
    beforeJson?: any;
    afterJson?: any;
    ip?: string;
    device?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        entityType: data.entityType,
        entityId: data.entityId,
        action: data.action,
        actorId: data.actorId,
        beforeJson: data.beforeJson || null,
        afterJson: data.afterJson || null,
        ip: data.ip,
        device: data.device,
      },
    });
  }
}
