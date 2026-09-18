import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { getRoleNames } from '../common/access-scope.js';
import {
  CreateProjectDto,
  UpdateProjectDto,
} from './dto/upsert-project.dto.js';
import { JwtStrategy } from '../auth/jwt.strategy.js';

const projectInclude = {
  lead: { select: { id: true, name: true, email: true, departmentId: true } },
  members: {
    include: {
      user: {
        select: { id: true, name: true, email: true, departmentId: true },
      },
    },
    orderBy: { user: { name: 'asc' as const } },
  },
} as const;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly jwtStrategy: JwtStrategy,
  ) {}

  async findVisible(user: any) {
    const roles = getRoleNames(user);
    const canManage = roles.includes('ceo') || roles.includes('it_admin');
    const canBrowseAll = canManage || roles.includes('department_head');
    const projects = await this.prisma.project.findMany({
      relationLoadStrategy: 'join',
      where: canManage
        ? undefined
        : canBrowseAll
          ? { isActive: true }
          : {
              isActive: true,
              OR: [
                { leadUserId: user.id },
                { members: { some: { userId: user.id } } },
              ],
            },
      include: projectInclude,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    if (roles.includes('ceo') || roles.includes('it_admin')) return projects;
    return projects.map(
      ({ id, code, name, location, leadUserId, isActive }) => ({
        id,
        code,
        name,
        location,
        leadUserId,
        isActive,
      }),
    );
  }

  async findAllForAdmin() {
    return this.prisma.project.findMany({
      relationLoadStrategy: 'join',
      include: projectInclude,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  private normalize(dto: CreateProjectDto | UpdateProjectDto) {
    return {
      code: dto.code.trim().toUpperCase(),
      name: dto.name.trim(),
      location: dto.location?.trim() || null,
      leadUserId: dto.leadUserId || null,
      memberIds: [...new Set(dto.memberIds || [])].filter(
        (userId) => userId !== dto.leadUserId,
      ),
      isActive: dto.isActive ?? true,
    };
  }

  private async assertUsersExist(userIds: number[]) {
    if (userIds.length === 0) return;
    const count = await this.prisma.user.count({
      where: { id: { in: userIds }, status: 'active' },
    });
    if (count !== userIds.length) {
      throw new BadRequestException(
        'Có người dùng không tồn tại hoặc đã bị khóa',
      );
    }
  }

  private async syncProjectLeadRole(
    tx: any,
    projectId: number,
    previousLeadUserId: number | null,
    nextLeadUserId: number | null,
  ) {
    if (!previousLeadUserId && !nextLeadUserId) return;
    const departmentHeadRole = await tx.role.findUnique({
      where: { name: 'department_head' },
      select: { id: true },
    });
    if (!departmentHeadRole) {
      throw new BadRequestException(
        'Hệ thống chưa có vai trò Trưởng Ban (department_head)',
      );
    }

    if (nextLeadUserId) {
      await tx.user.update({
        where: { id: nextLeadUserId },
        data: { roles: { connect: { id: departmentHeadRole.id } } },
      });
    }

    if (previousLeadUserId && previousLeadUserId !== nextLeadUserId) {
      const remainingLeadProjects = await tx.project.count({
        where: {
          leadUserId: previousLeadUserId,
          id: { not: projectId },
        },
      });
      if (remainingLeadProjects === 0) {
        await tx.user.update({
          where: { id: previousLeadUserId },
          data: { roles: { disconnect: { id: departmentHeadRole.id } } },
        });
      }
    }
  }

  async create(dto: CreateProjectDto, actorId: number, ip?: string) {
    const data = this.normalize(dto);
    await this.assertUsersExist([
      ...(data.leadUserId ? [data.leadUserId] : []),
      ...data.memberIds,
    ]);

    const duplicate = await this.prisma.project.findUnique({
      where: { code: data.code },
    });
    if (duplicate) throw new ConflictException('Mã dự án đã tồn tại');

    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          code: data.code,
          name: data.name,
          location: data.location,
          leadUserId: data.leadUserId,
          isActive: data.isActive,
          members: {
            create: data.memberIds.map((userId) => ({ userId })),
          },
        },
        include: projectInclude,
      });
      await this.syncProjectLeadRole(tx, created.id, null, data.leadUserId);
      return created;
    });
    if (data.leadUserId) this.jwtStrategy.invalidateUser(data.leadUserId);

    await this.auditService.logEvent({
      entityType: 'Project',
      entityId: result.id,
      action: 'create_project',
      actorId,
      afterJson: {
        code: result.code,
        name: result.name,
        leadUserId: result.leadUserId,
        memberIds: data.memberIds,
      },
      ip,
    });
    return result;
  }

  async update(
    id: number,
    dto: UpdateProjectDto,
    actorId: number,
    ip?: string,
  ) {
    const existing = await this.prisma.project.findUnique({
      where: { id },
      include: { members: true },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy dự án');

    const data = this.normalize(dto);
    await this.assertUsersExist([
      ...(data.leadUserId ? [data.leadUserId] : []),
      ...data.memberIds,
    ]);

    const duplicate = await this.prisma.project.findFirst({
      where: { code: data.code, id: { not: id } },
    });
    if (duplicate) throw new ConflictException('Mã dự án đã tồn tại');

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.projectMember.deleteMany({ where: { projectId: id } });
      const updated = await tx.project.update({
        where: { id },
        data: {
          code: data.code,
          name: data.name,
          location: data.location,
          leadUserId: data.leadUserId,
          isActive: data.isActive,
          members: {
            create: data.memberIds.map((userId) => ({
              userId,
              position:
                existing.members.find((member) => member.userId === userId)
                  ?.position || null,
            })),
          },
        },
        include: projectInclude,
      });
      await this.syncProjectLeadRole(
        tx,
        id,
        existing.leadUserId,
        data.leadUserId,
      );
      return updated;
    });
    if (existing.leadUserId)
      this.jwtStrategy.invalidateUser(existing.leadUserId);
    if (data.leadUserId) this.jwtStrategy.invalidateUser(data.leadUserId);

    await this.auditService.logEvent({
      entityType: 'Project',
      entityId: id,
      action: 'update_project',
      actorId,
      beforeJson: {
        code: existing.code,
        name: existing.name,
        leadUserId: existing.leadUserId,
        memberIds: existing.members.map((member) => member.userId),
        isActive: existing.isActive,
      },
      afterJson: {
        code: result.code,
        name: result.name,
        leadUserId: result.leadUserId,
        memberIds: data.memberIds,
        isActive: result.isActive,
      },
      ip,
    });
    return result;
  }
}
