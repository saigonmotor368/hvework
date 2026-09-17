import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { getRoleNames, getUserProjectIds } from '../common/access-scope.js';
import { CreateProjectDto, UpdateProjectDto } from './dto/upsert-project.dto.js';
import { CreateBoardMessageDto } from './dto/create-board-message.dto.js';

const projectInclude = {
  lead: { select: { id: true, name: true, email: true, departmentId: true } },
  members: {
    include: {
      user: { select: { id: true, name: true, email: true, departmentId: true } },
    },
    orderBy: { user: { name: 'asc' as const } },
  },
} as const;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // Kiểm tra quyền xem/tham gia Bảng tin của 1 dự án: CEO/BGĐ/IT Admin xem
  // được mọi bảng tin (đúng nguyên tắc "xem toàn bộ"); người khác chỉ được
  // vào bảng tin của dự án mình là trưởng dự án hoặc thành viên.
  private async assertBoardAccess(user: any, projectId: number) {
    const roles = getRoleNames(user);
    const canViewAll = roles.some((role) => ['ceo', 'bgd', 'it_admin'].includes(role));
    if (canViewAll) return;

    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Không tìm thấy dự án');

    const ownProjectIds = getUserProjectIds(user);
    if (!ownProjectIds.includes(projectId)) {
      throw new ForbiddenException('Bạn không thuộc dự án này nên không thể xem/tham gia bảng tin');
    }
  }

  async getBoardMessages(user: any, projectId: number) {
    await this.assertBoardAccess(user, projectId);

    const messages = await this.prisma.comment.findMany({
      where: { entityType: 'project_board', entityId: projectId },
      orderBy: { createdAt: 'asc' },
    });
    const userIds = [...new Set(messages.map((m) => m.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return messages.map((m) => ({
      ...m,
      user: userMap.get(m.userId) || { id: m.userId, name: 'Người dùng đã rời hệ thống' },
    }));
  }

  async postBoardMessage(user: any, projectId: number, dto: CreateBoardMessageDto) {
    await this.assertBoardAccess(user, projectId);

    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Không tìm thấy dự án');

    const message = await this.prisma.comment.create({
      data: {
        entityType: 'project_board',
        entityId: projectId,
        userId: user.id,
        content: dto.content,
        mentions: dto.mentions || [],
      },
    });

    if (dto.mentions && dto.mentions.length > 0) {
      for (const mentionedId of dto.mentions) {
        if (mentionedId !== user.id) {
          await this.notificationsService.dispatchNotification({
            userId: mentionedId,
            eventType: 'project_board_mention',
            entityRef: `project:${projectId}`,
            title: `${user.name || 'Đồng nghiệp'} đã nhắc đến bạn trong bảng tin "${project.name}"`,
            content: dto.content,
            link: `/projects?id=${projectId}&tab=board`,
            dedupeKey: `project_board_mention_${message.id}_${mentionedId}`,
          });
        }
      }
    }

    return { ...message, user: { id: user.id, name: user.name } };
  }

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
    return projects.map(({ id, code, name, location, leadUserId, isActive }) => ({
      id,
      code,
      name,
      location,
      leadUserId,
      isActive,
    }));
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
      memberIds: [...new Set(dto.memberIds || [])],
      isActive: dto.isActive ?? true,
    };
  }

  private async assertUsersExist(userIds: number[]) {
    if (userIds.length === 0) return;
    const count = await this.prisma.user.count({
      where: { id: { in: userIds }, status: 'active' },
    });
    if (count !== userIds.length) {
      throw new BadRequestException('Có người dùng không tồn tại hoặc đã bị khóa');
    }
  }

  private async assertLeadRole(leadUserId: number | null) {
    if (!leadUserId) return;
    const lead = await this.prisma.user.findFirst({
      where: {
        id: leadUserId,
        status: 'active',
        roles: { some: { name: { in: ['department_head', 'ceo'] } } },
      },
      select: { id: true },
    });
    if (!lead) {
      throw new BadRequestException('Trưởng dự án phải có vai trò Trưởng bộ phận hoặc CEO');
    }
  }

  async create(dto: CreateProjectDto, actorId: number, ip?: string) {
    const data = this.normalize(dto);
    await this.assertUsersExist([
      ...(data.leadUserId ? [data.leadUserId] : []),
      ...data.memberIds,
    ]);
    await this.assertLeadRole(data.leadUserId);

    const duplicate = await this.prisma.project.findUnique({ where: { code: data.code } });
    if (duplicate) throw new ConflictException('Mã dự án đã tồn tại');

    const result = await this.prisma.project.create({
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

  async update(id: number, dto: UpdateProjectDto, actorId: number, ip?: string) {
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
    await this.assertLeadRole(data.leadUserId);

    const duplicate = await this.prisma.project.findFirst({
      where: { code: data.code, id: { not: id } },
    });
    if (duplicate) throw new ConflictException('Mã dự án đã tồn tại');

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.projectMember.deleteMany({ where: { projectId: id } });
      return tx.project.update({
        where: { id },
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
    });

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
