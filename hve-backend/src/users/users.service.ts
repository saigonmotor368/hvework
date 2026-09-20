import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async updateAvatar(userId: number, avatarUrl: string, ip?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, avatarUrl: true },
    });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });
    await this.auditService.logEvent({
      entityType: 'User',
      entityId: userId,
      action: 'update_avatar',
      actorId: userId,
      beforeJson: { avatarUrl: user.avatarUrl },
      afterJson: { avatarUrl },
      ip,
    });
    return updated;
  }

  async findProfile(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        status: true,
        department: { select: { id: true, code: true, name: true } },
        roles: { select: { id: true, name: true, description: true } },
        ledProjects: {
          where: { isActive: true },
          select: { id: true, code: true, name: true, location: true },
        },
        projectMemberships: {
          where: { project: { isActive: true } },
          select: {
            position: true,
            project: {
              select: { id: true, code: true, name: true, location: true },
            },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return user;
  }
}
