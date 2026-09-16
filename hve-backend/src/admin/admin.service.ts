import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        status: true,
        departmentId: true,
        department: {
          select: { id: true, name: true, code: true },
        },
        roles: {
          select: { id: true, name: true, description: true },
        },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { id: 'asc' },
    });
  }

  async findAllRoles() {
    return this.prisma.role.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async findAllDepartments() {
    return this.prisma.department.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async updateUserStatus(
    targetUserId: number,
    dto: UpdateUserStatusDto,
    currentUserId: number,
    ip?: string,
  ) {
    if (targetUserId === currentUserId && dto.status === 'locked') {
      throw new BadRequestException(
        'Quy định an toàn: Quản trị viên không thể tự khóa tài khoản của chính mình',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        status: dto.status,
      },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        department: true,
        roles: true,
      },
    });

    await this.auditService.logEvent({
      entityType: 'User',
      entityId: user.id,
      action: 'update_user_status',
      actorId: currentUserId,
      beforeJson: { status: user.status },
      afterJson: { status: dto.status },
      ip,
    });

    return updatedUser;
  }

  async updateUserRoles(
    targetUserId: number,
    dto: UpdateUserRolesDto,
    currentUserId: number,
    ip?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { roles: true },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    // Validate that all roleIds exist in database
    const rolesInDb = await this.prisma.role.findMany({
      where: { id: { in: dto.roleIds } },
    });

    if (rolesInDb.length !== dto.roleIds.length) {
      throw new BadRequestException('Một hoặc nhiều mã vai trò không hợp lệ');
    }

    // Validate departmentId if provided
    if (dto.departmentId) {
      const dept = await this.prisma.department.findUnique({
        where: { id: dto.departmentId },
      });
      if (!dept) {
        throw new BadRequestException('Phòng ban không tồn tại');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        departmentId: dto.departmentId === undefined ? user.departmentId : dto.departmentId,
        roles: {
          set: dto.roleIds.map((id) => ({ id })),
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        department: true,
        roles: true,
      },
    });

    await this.auditService.logEvent({
      entityType: 'User',
      entityId: user.id,
      action: 'update_user_roles',
      actorId: currentUserId,
      beforeJson: {
        departmentId: user.departmentId,
        roles: user.roles.map((r) => r.name),
      },
      afterJson: {
        departmentId: updatedUser.department?.id,
        roles: updatedUser.roles.map((r) => r.name),
      },
      ip,
    });

    return updatedUser;
  }
}
