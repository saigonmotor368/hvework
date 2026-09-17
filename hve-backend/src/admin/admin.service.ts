import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';

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
        ledProjects: { select: { id: true, code: true, name: true } },
        projectMemberships: {
          select: { project: { select: { id: true, code: true, name: true } } },
        },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { id: 'asc' },
    });
  }

  // Đồng bộ danh sách Dự án của 1 user: xóa hết ProjectMember cũ rồi tạo
  // lại đúng theo danh sách mới — cùng cách ProjectsService làm ở chiều
  // ngược lại (từ dự án chọn thành viên), giữ nhất quán logic 2 chiều.
  private async syncUserProjects(userId: number, projectIds: number[]) {
    const uniqueIds = [...new Set(projectIds)];
    if (uniqueIds.length > 0) {
      const count = await this.prisma.project.count({ where: { id: { in: uniqueIds } } });
      if (count !== uniqueIds.length) {
        throw new BadRequestException('Có dự án không tồn tại');
      }
    }
    await this.prisma.$transaction([
      this.prisma.projectMember.deleteMany({ where: { userId } }),
      this.prisma.projectMember.createMany({
        data: uniqueIds.map((projectId) => ({ userId, projectId })),
      }),
    ]);
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

  async createUser(dto: CreateUserDto, currentUserId: number, ip?: string) {
    const emailLower = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: emailLower },
    });
    if (existing) {
      throw new ConflictException('Email này đã tồn tại trong hệ thống');
    }

    // Validate roles
    const rolesInDb = await this.prisma.role.findMany({
      where: { id: { in: dto.roleIds } },
    });
    if (rolesInDb.length !== dto.roleIds.length) {
      throw new BadRequestException('Một hoặc nhiều mã vai trò không hợp lệ');
    }

    if (dto.departmentId) {
      const dept = await this.prisma.department.findUnique({
        where: { id: dto.departmentId },
      });
      if (!dept) {
        throw new BadRequestException('Phòng ban không tồn tại');
      }
    }

    const rawPassword = dto.password || 'Hve@2026';
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const newUser = await this.prisma.user.create({
      data: {
        email: emailLower,
        name: dto.name.trim(),
        passwordHash,
        departmentId: dto.departmentId || null,
        status: 'active',
        roles: {
          connect: dto.roleIds.map((id) => ({ id })),
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        department: { select: { id: true, name: true, code: true } },
        roles: { select: { id: true, name: true, description: true } },
        createdAt: true,
      },
    });

    if (dto.projectIds !== undefined) {
      await this.syncUserProjects(newUser.id, dto.projectIds);
    }

    await this.auditService.logEvent({
      entityType: 'User',
      entityId: newUser.id,
      action: 'create_user',
      actorId: currentUserId,
      afterJson: {
        email: newUser.email,
        name: newUser.name,
        roles: newUser.roles.map((r) => r.name),
      },
      ip,
    });

    return newUser;
  }

  async updateUser(
    targetUserId: number,
    dto: UpdateUserDto,
    currentUserId: number,
    ip?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { roles: true, department: true },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const updateData: any = {};

    if (dto.name !== undefined && dto.name.trim() !== '') {
      updateData.name = dto.name.trim();
    }

    if (dto.email !== undefined && dto.email.trim().toLowerCase() !== user.email) {
      const emailLower = dto.email.trim().toLowerCase();
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: emailLower },
      });
      if (existingEmail && existingEmail.id !== targetUserId) {
        throw new ConflictException('Email này đã được sử dụng bởi người dùng khác');
      }
      updateData.email = emailLower;
      updateData.emailVerifiedAt = null;
      updateData.refreshTokenHash = null;
    }

    if (dto.departmentId !== undefined) {
      if (dto.departmentId !== null) {
        const dept = await this.prisma.department.findUnique({
          where: { id: dto.departmentId },
        });
        if (!dept) {
          throw new BadRequestException('Phòng ban không tồn tại');
        }
      }
      updateData.departmentId = dto.departmentId;
    }

    if (dto.roleIds !== undefined) {
      if (dto.roleIds.length === 0) {
        throw new BadRequestException('Người dùng phải có ít nhất 1 vai trò');
      }
      const rolesInDb = await this.prisma.role.findMany({
        where: { id: { in: dto.roleIds } },
      });
      if (rolesInDb.length !== dto.roleIds.length) {
        throw new BadRequestException('Một hoặc nhiều mã vai trò không hợp lệ');
      }
      updateData.roles = {
        set: dto.roleIds.map((id) => ({ id })),
      };
    }

    if (dto.status !== undefined) {
      if (targetUserId === currentUserId && dto.status === 'locked') {
        throw new BadRequestException(
          'Quản trị viên không thể tự khóa tài khoản của chính mình',
        );
      }
      updateData.status = dto.status;
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: targetUserId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        department: { select: { id: true, name: true, code: true } },
        roles: { select: { id: true, name: true, description: true } },
        updatedAt: true,
      },
    });

    if (dto.projectIds !== undefined) {
      await this.syncUserProjects(targetUserId, dto.projectIds);
    }

    if (updateData.emailVerifiedAt === null) {
      await this.prisma.trustedDevice.deleteMany({ where: { userId: targetUserId } });
      await this.prisma.loginChallenge.deleteMany({ where: { userId: targetUserId } });
    }

    await this.auditService.logEvent({
      entityType: 'User',
      entityId: user.id,
      action: 'update_user',
      actorId: currentUserId,
      beforeJson: {
        name: user.name,
        email: user.email,
        departmentId: user.departmentId,
        roles: user.roles.map((r) => r.name),
        status: user.status,
      },
      afterJson: {
        name: updatedUser.name,
        email: updatedUser.email,
        departmentId: updatedUser.department?.id,
        roles: updatedUser.roles.map((r) => r.name),
        status: updatedUser.status,
      },
      ip,
    });

    return updatedUser;
  }

  async resetPassword(
    targetUserId: number,
    dto: ResetPasswordDto,
    currentUserId: number,
    ip?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const targetPassword = dto?.newPassword || 'Hve@2026';
    const passwordHash = await bcrypt.hash(targetPassword, 10);

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
        status: 'active',
        refreshTokenHash: null,
        emailVerifiedAt: null,
      },
    });

    await this.prisma.trustedDevice.deleteMany({ where: { userId: targetUserId } });
    await this.prisma.loginChallenge.deleteMany({ where: { userId: targetUserId } });

    await this.auditService.logEvent({
      entityType: 'User',
      entityId: user.id,
      action: 'reset_user_password',
      actorId: currentUserId,
      ip,
    });

    return {
      success: true,
      message: `Đã đặt lại mật khẩu cho ${user.name} thành công. Mật khẩu mới: ${targetPassword}`,
      defaultPassword: targetPassword,
    };
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

    const rolesInDb = await this.prisma.role.findMany({
      where: { id: { in: dto.roleIds } },
    });

    if (rolesInDb.length !== dto.roleIds.length) {
      throw new BadRequestException('Một hoặc nhiều mã vai trò không hợp lệ');
    }

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

  async deleteTask(taskId: number, currentUserId: number, ip?: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { subTasks: true },
    });
    if (!task) {
      throw new NotFoundException('Không tìm thấy công việc');
    }

    // 1. Delete comments & attachments for subtasks
    const subTaskIds = task.subTasks.map((st) => st.id);
    if (subTaskIds.length > 0) {
      await this.prisma.comment.deleteMany({
        where: { entityType: 'task', entityId: { in: subTaskIds } },
      });
      await this.prisma.attachment.deleteMany({
        where: { entityType: 'task', entityId: { in: subTaskIds } },
      });
      await this.prisma.task.deleteMany({
        where: { id: { in: subTaskIds } },
      });
    }

    // 2. Delete comments & attachments for main task
    await this.prisma.comment.deleteMany({
      where: { entityType: 'task', entityId: taskId },
    });
    await this.prisma.attachment.deleteMany({
      where: { entityType: 'task', entityId: taskId },
    });

    // 3. Delete the task
    await this.prisma.task.delete({
      where: { id: taskId },
    });

    await this.auditService.logEvent({
      entityType: 'Task',
      entityId: taskId,
      action: 'admin_delete_stuck_task',
      actorId: currentUserId,
      beforeJson: { code: task.code, title: task.title },
      ip,
    });

    return { success: true, message: `Đã xóa công việc [${task.code}] ${task.title}` };
  }

  async deleteDocument(documentId: number, currentUserId: number, ip?: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc) {
      throw new NotFoundException('Không tìm thấy hồ sơ');
    }

    // 1. Delete approval steps
    await this.prisma.documentApprovalStep.deleteMany({
      where: { documentId },
    });

    // 2. Delete comments and attachments
    await this.prisma.comment.deleteMany({
      where: { entityType: 'document', entityId: documentId },
    });
    await this.prisma.attachment.deleteMany({
      where: { entityType: 'document', entityId: documentId },
    });

    // 3. Delete the document
    await this.prisma.document.delete({
      where: { id: documentId },
    });

    await this.auditService.logEvent({
      entityType: 'Document',
      entityId: documentId,
      action: 'admin_delete_stuck_document',
      actorId: currentUserId,
      beforeJson: { code: doc.code, title: doc.title },
      ip,
    });

    return { success: true, message: `Đã xóa hồ sơ [${doc.code}] ${doc.title}` };
  }

  async getStuckData() {
    const [tasks, documents] = await Promise.all([
      this.prisma.task.findMany({
        where: { parentTaskId: null },
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          priority: true,
          progressPercent: true,
          createdAt: true,
          createdBy: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
          _count: { select: { subTasks: true } },
        },
        orderBy: { id: 'desc' },
      }),
      this.prisma.document.findMany({
        select: {
          id: true,
          code: true,
          title: true,
          type: true,
          status: true,
          createdAt: true,
          createdBy: { select: { id: true, name: true, email: true } },
          steps: {
            select: {
              stepOrder: true,
              roleRequired: true,
              status: true,
            },
            orderBy: { stepOrder: 'asc' },
          },
        },
        orderBy: { id: 'desc' },
      }),
    ]);

    return { tasks, documents };
  }
}
