import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { UpdateProgressDto } from './dto/update-progress.dto.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { TaskQueryDto } from './dto/task-query.dto.js';
import { ExtendTaskDto, TaskReasonDto } from './dto/task-lifecycle.dto.js';
import {
  TASK_INACTIVE_STATUSES,
  TASK_LIVE_STATUSES,
  TASK_STATUS,
  isTaskInactive,
} from './task-status.js';
import {
  buildTaskAccessWhere,
  getDepartmentId,
  getRoleNames,
  getUserProjectIds,
} from '../common/access-scope.js';

/**
 * Helper: Cộng thêm `months` tháng an toàn, chống tràn ngày cuối tháng (VD: 31/01 -> 28/02)
 */
export function addMonthsSafe(date: Date, months: number): Date {
  const d = date.getDate();
  const result = new Date(date.getTime());
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const maxDays = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(d, maxDays));
  return result;
}

/**
 * Helper: Tính nextDueDate dựa trên chu kỳ lặp và tịnh tiến (round-forward) tới tương lai gần nhất (>= now)
 */
export function calculateNextDueDate(
  currentDueDate: Date,
  recurrenceRule: string,
  now: Date = new Date(),
): Date {
  let next = new Date(currentDueDate.getTime());

  const advance = (d: Date): Date => {
    if (recurrenceRule === 'daily') {
      const res = new Date(d.getTime());
      res.setDate(res.getDate() + 1);
      return res;
    } else if (recurrenceRule === 'weekly') {
      const res = new Date(d.getTime());
      res.setDate(res.getDate() + 7);
      return res;
    } else if (recurrenceRule === 'monthly') {
      return addMonthsSafe(d, 1);
    }
    return d;
  };

  // Ít nhất phải tăng 1 chu kỳ
  next = advance(next);

  // Round-forward: Nếu next vẫn nhỏ hơn now, tiếp tục tăng cho tới khi next >= now
  let safetyCounter = 0;
  while (next.getTime() < now.getTime() && safetyCounter < 1000) {
    next = advance(next);
    safetyCounter++;
  }

  return next;
}

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationsService: NotificationsService,
  ) {}

  private async validateProjectSelection(
    user: any,
    projectId?: number,
    linkedProjectIds: number[] = [],
  ) {
    const selectedIds = [
      ...new Set([...(projectId ? [projectId] : []), ...linkedProjectIds]),
    ];
    if (selectedIds.length === 0) return;
    const count = await this.prisma.project.count({
      where: { id: { in: selectedIds }, isActive: true },
    });
    if (count !== selectedIds.length) {
      throw new BadRequestException(
        'Có dự án không tồn tại hoặc đã ngừng hoạt động',
      );
    }
    const roles = getRoleNames(user);
    if (
      projectId &&
      !roles.some((role) =>
        ['ceo', 'bgd', 'it_admin', 'accountant'].includes(role),
      ) &&
      !getUserProjectIds(user).includes(projectId)
    ) {
      throw new ForbiddenException('Bạn không thuộc dự án đã chọn');
    }
  }

  private async validateNewAttachments(
    userId: number,
    attachmentIds: number[] = [],
  ) {
    if (attachmentIds.length === 0) return;
    const uniqueIds = [...new Set(attachmentIds)];
    const count = await this.prisma.attachment.count({
      where: { id: { in: uniqueIds }, uploadedById: userId, entityId: 0 },
    });
    if (count !== uniqueIds.length) {
      throw new ForbiddenException(
        'Có tệp đính kèm không thuộc phiên tải lên của bạn',
      );
    }
  }

  private hasRole(
    user: { roles?: Array<string | { name: string }> },
    roleName: string,
  ): boolean {
    return (user.roles || []).some((role) =>
      typeof role === 'string' ? role === roleName : role.name === roleName,
    );
  }

  /** Nhân sự được phân công phải thuộc dự án (hoặc phòng ban) của người giao việc. */
  private async assertParticipantsInScope(
    user: { departmentId?: number | null },
    ids: Array<number | undefined | null>,
    projectId?: number | null,
  ) {
    const participantIds = [
      ...new Set(
        ids.filter((id): id is number => typeof id === 'number'),
      ),
    ];
    for (const participantId of participantIds) {
      const participant = await this.prisma.user.findFirst({
        where: { id: participantId, status: 'active' },
        select: {
          departmentId: true,
          ledProjects: { select: { id: true } },
          projectMemberships: { select: { projectId: true } },
        },
      });
      const participantProjectIds = [
        ...(participant?.ledProjects || []).map((project) => project.id),
        ...(participant?.projectMemberships || []).map(
          (membership) => membership.projectId,
        ),
      ];
      const allowed = projectId
        ? participantProjectIds.includes(projectId)
        : !!participant &&
          !!user.departmentId &&
          participant.departmentId === user.departmentId;
      if (!allowed) {
        throw new ForbiddenException(
          projectId
            ? 'Chỉ được phân công nhân sự thuộc dự án đã chọn'
            : 'Trưởng Ban / Trưởng dự án chỉ được phân công nhân sự trong phạm vi mình phụ trách',
        );
      }
    }
  }

  /**
   * Quyền quản lý vòng đời công việc (sửa / gia hạn / tạm ngừng / hủy / khôi phục):
   * người giao việc, CEO, Ban Giám Đốc hoặc Trưởng dự án / Trưởng Ban trong phạm vi.
   */
  private canManageTask(
    user: {
      id: number;
      roles?: Array<string | { name: string }>;
      departmentId?: number | null;
    },
    task: any,
  ): boolean {
    if (task.createdById === user.id) return true;
    if (this.hasRole(user, 'ceo') || this.hasRole(user, 'bgd')) return true;
    if (!this.hasRole(user, 'department_head')) return false;
    const linked = Array.isArray(task.linkedProjectIds)
      ? (task.linkedProjectIds as number[])
      : [];
    const projectIds = getUserProjectIds(user);
    if (task.projectId) {
      return (
        projectIds.includes(task.projectId) ||
        linked.some((id) => projectIds.includes(id))
      );
    }
    return (
      !!user.departmentId &&
      !!task.createdBy?.departmentId &&
      user.departmentId === task.createdBy.departmentId
    );
  }

  /**
   * Sinh mã công việc tự động định dạng CV-YYYY-NNN
   */
  async generateTaskCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CV-${year}-`;

    const latest = await this.prisma.task.findFirst({
      where: {
        code: { startsWith: prefix },
      },
      orderBy: { code: 'desc' },
    });

    let nextSeq = 1;
    if (latest && latest.code) {
      const parts = latest.code.split('-');
      if (parts.length === 3) {
        const lastSeq = parseInt(parts[2], 10);
        if (!isNaN(lastSeq)) {
          nextSeq = lastSeq + 1;
        }
      }
    }

    return `${prefix}${String(nextSeq).padStart(3, '0')}`;
  }

  /**
   * Lấy danh sách người dùng khả dụng để giao việc và phối hợp
   */
  async getAssignableUsers(user: {
    id: number;
    roles?: Array<string | { name: string }>;
    departmentId?: number | null;
  }) {
    const roles = getRoleNames(user);
    if (
      !roles.includes('ceo') &&
      !roles.includes('bgd') &&
      !roles.includes('department_head') &&
      !roles.includes('accountant')
    )
      return [];

    const projectIds = getUserProjectIds(user);
    return this.prisma.user.findMany({
      where: {
        status: 'active',
        ...(!roles.includes('ceo') &&
        !roles.includes('bgd') &&
        !roles.includes('accountant')
          ? projectIds.length > 0
            ? {
                OR: [
                  {
                    ledProjects: {
                      some: { id: { in: projectIds }, isActive: true },
                    },
                  },
                  {
                    projectMemberships: {
                      some: {
                        projectId: { in: projectIds },
                        project: { isActive: true },
                      },
                    },
                  },
                ],
              }
            : { departmentId: getDepartmentId(user) || -1 }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        departmentId: true,
        department: { select: { id: true, name: true, code: true } },
        ledProjects: {
          where: { isActive: true },
          select: { id: true, code: true, name: true },
        },
        projectMemberships: {
          where: { project: { isActive: true } },
          select: {
            position: true,
            project: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getWorkloadSummary(user: any, projectId?: number) {
    const baseConditions: any[] = [
      buildTaskAccessWhere(user),
      { status: { notIn: TASK_INACTIVE_STATUSES } },
      { assigneeId: { not: null } },
    ];
    if (projectId) baseConditions.push({ projectId });

    const now = new Date();
    const [grouped, overdueGrouped] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['assigneeId'],
        where: { AND: baseConditions },
        _count: { _all: true },
      }),
      this.prisma.task.groupBy({
        by: ['assigneeId'],
        where: {
          AND: [...baseConditions, { dueDate: { lt: now } }],
        },
        _count: { _all: true },
      }),
    ]);

    const roles = getRoleNames(user);
    const assignableUsers = roles.some((role) =>
      ['ceo', 'bgd', 'department_head', 'accountant'].includes(role),
    )
      ? await this.getAssignableUsers(user)
      : await this.prisma.user.findMany({
          where: {
            id: {
              in: [
                user.id,
                ...grouped
                  .map((item: any) => item.assigneeId)
                  .filter((id: any): id is number => typeof id === 'number'),
              ],
            },
            status: 'active',
          },
          select: { id: true, name: true, email: true },
          orderBy: { name: 'asc' },
        });

    const activeByUser = new Map(
      grouped.map((item: any) => [item.assigneeId, item._count._all]),
    );
    const overdueByUser = new Map(
      overdueGrouped.map((item: any) => [item.assigneeId, item._count._all]),
    );

    return assignableUsers.map((person: any) => {
      const activeCount = Number(activeByUser.get(person.id) || 0);
      const overdueCount = Number(overdueByUser.get(person.id) || 0);
      return {
        userId: person.id,
        name: person.name,
        email: person.email,
        activeCount,
        overdueCount,
        level: activeCount >= 6 ? 'qua_tai' : activeCount >= 3 ? 'vua' : 'ranh',
      };
    });
  }

  /**
   * Tạo công việc mới (có thể là việc cha hoặc việc con)
   */
  async createTask(
    user: {
      id: number;
      name: string;
      roles?: Array<string | { name: string }>;
      departmentId?: number | null;
    },
    dto: CreateTaskDto,
    ip?: string,
  ) {
    if (
      !this.hasRole(user, 'department_head') &&
      !this.hasRole(user, 'accountant') &&
      !this.hasRole(user, 'ceo') &&
      !this.hasRole(user, 'bgd')
    ) {
      throw new ForbiddenException(
        'Chỉ Trưởng Ban / Trưởng dự án, Kế toán, Ban Giám Đốc hoặc CEO mới có quyền giao việc',
      );
    }

    let parentTask: any = null;
    if (dto.parentTaskId) {
      parentTask = await this.prisma.task.findFirst({
        where: { AND: [{ id: dto.parentTaskId }, buildTaskAccessWhere(user)] },
      });
      if (!parentTask)
        throw new NotFoundException('Không tìm thấy công việc cha');
    }
    const effectiveProjectId = parentTask?.projectId ?? dto.projectId;
    const effectiveLinkedProjectIds = parentTask
      ? Array.isArray(parentTask.linkedProjectIds)
        ? parentTask.linkedProjectIds
        : []
      : dto.linkedProjectIds || [];
    await this.validateProjectSelection(
      user,
      effectiveProjectId,
      effectiveLinkedProjectIds,
    );
    await this.validateNewAttachments(user.id, dto.attachmentIds);

    if (
      !this.hasRole(user, 'ceo') &&
      !this.hasRole(user, 'bgd') &&
      !this.hasRole(user, 'accountant')
    ) {
      await this.assertParticipantsInScope(
        user,
        [dto.assigneeId, ...(dto.collaboratorIds || [])],
        effectiveProjectId,
      );
    }

    // 1. Kiểm tra giới hạn 2 cấp công việc
    if (dto.parentTaskId) {
      if (parentTask.parentTaskId) {
        throw new BadRequestException(
          'Chỉ cho phép tối đa 2 cấp công việc (việc cha và việc con)',
        );
      }
      // Điểm chốt 4: Việc lặp lại chỉ áp dụng cho việc độc lập
      if (dto.recurrenceRule) {
        throw new BadRequestException(
          'Chỉ công việc độc lập mới được đặt chu kỳ lặp lại, không áp dụng cho việc con',
        );
      }
      if (parentTask.recurrenceRule) {
        throw new BadRequestException(
          'Không thể thêm việc con vào công việc có chu kỳ lặp lại',
        );
      }
    }

    const code = await this.generateTaskCode();

    const task = await this.prisma.task.create({
      data: {
        code,
        title: dto.title,
        description: dto.description || null,
        priority: dto.priority || 'normal',
        status: 'Chưa làm',
        progressPercent: 0,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        assigneeId: dto.assigneeId || null,
        createdById: user.id,
        parentTaskId: dto.parentTaskId || null,
        recurrenceRule: dto.recurrenceRule || null,
        tags: dto.tags || null,
        collaboratorIds: (dto.collaboratorIds as any) ?? undefined,
        projectId: effectiveProjectId || null,
        linkedProjectIds: effectiveLinkedProjectIds,
        visibility:
          parentTask?.visibility ||
          (dto.isCompanyVisible
            ? 'company'
            : this.hasRole(user, 'bgd')
              ? dto.assigneeId
                ? 'targeted'
                : 'company'
              : 'scoped'),
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        project: true,
      },
    });

    // Nếu có file đính kèm, gắn vào task
    if (dto.attachmentIds && dto.attachmentIds.length > 0) {
      await this.prisma.attachment.updateMany({
        where: {
          id: { in: dto.attachmentIds },
          uploadedById: user.id,
          entityId: 0,
        },
        data: {
          entityType: 'task',
          entityId: task.id,
        },
      });
    }

    // Ghi audit log
    await this.auditService.logEvent({
      entityType: 'task',
      entityId: task.id,
      action: 'create_task',
      actorId: user.id,
      afterJson: {
        id: task.id,
        code: task.code,
        title: task.title,
        assigneeId: task.assigneeId,
        dueDate: task.dueDate,
      },
      ip,
    });

    // Bắn notification cho người được giao
    if (dto.assigneeId && dto.assigneeId !== user.id) {
      await this.notificationsService.dispatchNotification({
        userId: dto.assigneeId,
        eventType: 'task_assigned',
        entityRef: `task:${task.id}`,
        title: `Công việc mới: ${task.code}`,
        content: `Bạn được giao việc "${task.title}" bởi ${user.name}. Hạn hoàn thành: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString('vi-VN') : 'chưa xác định'}.`,
        link: `/tasks?id=${task.id}`,
        dedupeKey: `task_assign_${task.id}_${dto.assigneeId}_${Date.now()}`,
      });
    }

    const collaboratorIds = [
      ...new Set(
        (dto.collaboratorIds || []).filter(
          (collaboratorId) =>
            collaboratorId !== user.id && collaboratorId !== dto.assigneeId,
        ),
      ),
    ];
    await Promise.all(
      collaboratorIds.map((collaboratorId) =>
        this.notificationsService.dispatchNotification({
          userId: collaboratorId,
          eventType: 'task_collaborator_assigned',
          entityRef: `task:${task.id}`,
          title: `Phối hợp công việc: ${task.code}`,
          content: `Bạn được phân công phối hợp thực hiện “${task.title}” bởi ${user.name}.`,
          link: `/tasks?id=${task.id}`,
          dedupeKey: `task_collaborator_${task.id}_${collaboratorId}_${Date.now()}`,
        }),
      ),
    );

    return task;
  }

  /**
   * Cập nhật thông tin công việc
   */
  async updateTask(
    user: {
      id: number;
      roles?: Array<string | { name: string }>;
      departmentId?: number | null;
    },
    taskId: number,
    dto: UpdateTaskDto,
    ip?: string,
  ) {
    const task = await this.prisma.task.findFirst({
      where: { AND: [{ id: taskId }, buildTaskAccessWhere(user)] },
      include: {
        createdBy: true,
        subTasks: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Không tìm thấy công việc');
    }

    // Chặn gán recurrenceRule cho việc con hoặc việc cha đã có việc con
    if (dto.recurrenceRule) {
      if (task.parentTaskId) {
        throw new BadRequestException(
          'Chỉ công việc độc lập mới được đặt chu kỳ lặp lại, không áp dụng cho việc con',
        );
      }
      if (task.subTasks && task.subTasks.length > 0) {
        throw new BadRequestException(
          'Không thể đặt chu kỳ lặp lại cho công việc đã có việc con',
        );
      }
    }

    if (task.status === TASK_STATUS.CANCELLED) {
      throw new BadRequestException(
        'Công việc đã hủy nên không thể chỉnh sửa. Hãy khôi phục công việc trước.',
      );
    }
    if (!this.canManageTask(user, task)) {
      throw new ForbiddenException(
        'Chỉ người giao việc, Trưởng Ban / Trưởng dự án trong phạm vi, Ban Giám Đốc hoặc CEO mới được chỉnh sửa công việc',
      );
    }
    if (dto.title !== undefined && !dto.title.trim()) {
      throw new BadRequestException('Tiêu đề công việc không được để trống');
    }
    const previousCollaborators = Array.isArray(task.collaboratorIds)
      ? (task.collaboratorIds as number[])
      : [];
    const addedCollaborators =
      dto.collaboratorIds !== undefined
        ? dto.collaboratorIds.filter((id) => !previousCollaborators.includes(id))
        : [];
    if (
      addedCollaborators.length > 0 &&
      !this.hasRole(user, 'ceo') &&
      !this.hasRole(user, 'bgd') &&
      !this.hasRole(user, 'accountant')
    ) {
      await this.assertParticipantsInScope(
        user,
        addedCollaborators,
        task.projectId,
      );
    }

    // Phân quyền đổi assigneeId hoặc dueDate:
    // Chỉ người giao (createdById), Trưởng BP cùng phòng, hoặc CEO mới được đổi
    const hasAssigneeChange =
      dto.assigneeId !== undefined && dto.assigneeId !== task.assigneeId;
    const hasDueDateChange =
      dto.dueDate !== undefined &&
      (task.dueDate
        ? new Date(dto.dueDate).getTime() !== new Date(task.dueDate).getTime()
        : true);

    if (hasAssigneeChange || hasDueDateChange) {
      const isCreator = task.createdById === user.id;
      const isCeo = this.hasRole(user, 'ceo');
      const isBoard = this.hasRole(user, 'bgd');
      const isDepartmentHead = this.hasRole(user, 'department_head');
      const isAccountant = this.hasRole(user, 'accountant');
      const taskLinkedProjectIds = Array.isArray(task.linkedProjectIds)
        ? (task.linkedProjectIds as number[])
        : [];
      const userProjectIds = getUserProjectIds(user);
      const isHeadOfTaskScope =
        isDepartmentHead &&
        (task.projectId
          ? userProjectIds.includes(task.projectId) ||
            taskLinkedProjectIds.some((id) => userProjectIds.includes(id))
          : !!user.departmentId &&
            !!task.createdBy?.departmentId &&
            user.departmentId === task.createdBy.departmentId);

      if (
        hasAssigneeChange &&
        !isCeo &&
        !isBoard &&
        !isDepartmentHead &&
        !isAccountant
      ) {
        throw new ForbiddenException(
          'Chỉ Kế toán, Trưởng Ban / Trưởng dự án, Ban Giám Đốc hoặc CEO mới có quyền thay đổi người thực hiện',
        );
      }

      if (
        hasDueDateChange &&
        !isCreator &&
        !isCeo &&
        !isBoard &&
        !isHeadOfTaskScope
      ) {
        throw new ForbiddenException(
          'Chỉ người giao việc, Trưởng Ban / Trưởng dự án trong phạm vi hoặc CEO mới có quyền thay đổi hạn hoàn thành',
        );
      }

      if (
        hasAssigneeChange &&
        dto.assigneeId &&
        !isCeo &&
        !isBoard &&
        task.projectId
      ) {
        const target = await this.prisma.user.findUnique({
          where: { id: dto.assigneeId },
          include: { ledProjects: true, projectMemberships: true },
        });
        const targetProjectIds = [
          ...(target?.ledProjects || []).map((project) => project.id),
          ...(target?.projectMemberships || []).map(
            (membership) => membership.projectId,
          ),
        ];
        const targetAllowed = targetProjectIds.includes(task.projectId);
        if (!targetAllowed) {
          throw new ForbiddenException(
            'Người thực hiện mới không thuộc phạm vi dự án của công việc',
          );
        }
      }

      // Ghi audit log thay đổi phân công hoặc thời hạn
      await this.auditService.logEvent({
        entityType: 'task',
        entityId: task.id,
        action: 'reassign_or_reschedule',
        actorId: user.id,
        beforeJson: {
          assigneeId: task.assigneeId,
          dueDate: task.dueDate,
        },
        afterJson: {
          assigneeId: dto.assigneeId ?? task.assigneeId,
          dueDate: dto.dueDate ?? task.dueDate,
        },
        ip,
      });
    }

    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        title: dto.title !== undefined ? dto.title.trim() : undefined,
        description: dto.description ?? undefined,
        priority: dto.priority ?? undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        assigneeId: dto.assigneeId !== undefined ? dto.assigneeId : undefined,
        collaboratorIds:
          dto.collaboratorIds !== undefined ? dto.collaboratorIds : undefined,
        tags: dto.tags !== undefined ? dto.tags : undefined,
        recurrenceRule:
          dto.recurrenceRule !== undefined ? dto.recurrenceRule : undefined,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    // Nếu đổi assignee, thông báo cho assignee mới
    if (hasAssigneeChange && dto.assigneeId && dto.assigneeId !== user.id) {
      await this.notificationsService.dispatchNotification({
        userId: dto.assigneeId,
        eventType: 'task_reassigned',
        entityRef: `task:${taskId}`,
        title: `Bạn được giao việc: ${updatedTask.code}`,
        content: `Công việc "${updatedTask.title}" vừa được chuyển giao cho bạn phụ trách.`,
        link: `/tasks?id=${taskId}`,
        dedupeKey: `task_reassigned_${taskId}_${dto.assigneeId}_${Date.now()}`,
      });
    }

    const newCollaborators = addedCollaborators.filter(
      (id) => id !== user.id && id !== updatedTask.assigneeId,
    );
    await Promise.all(
      newCollaborators.map((collaboratorId) =>
        this.notificationsService.dispatchNotification({
          userId: collaboratorId,
          eventType: 'task_collaborator_assigned',
          entityRef: `task:${taskId}`,
          title: `Phối hợp công việc: ${updatedTask.code}`,
          content: `Bạn được thêm vào phối hợp thực hiện “${updatedTask.title}”.`,
          link: `/tasks?id=${taskId}`,
          dedupeKey: `task_collaborator_${taskId}_${collaboratorId}_${Date.now()}`,
        }),
      ),
    );

    const changedFields = (
      [
        'title',
        'description',
        'priority',
        'startDate',
        'tags',
        'collaboratorIds',
      ] as const
    ).filter((field) => dto[field] !== undefined);
    if (changedFields.length > 0) {
      await this.auditService.logEvent({
        entityType: 'task',
        entityId: taskId,
        action: 'update_task',
        actorId: user.id,
        beforeJson: {
          title: task.title,
          description: task.description,
          priority: task.priority,
          startDate: task.startDate,
          tags: task.tags,
          collaboratorIds: task.collaboratorIds,
        },
        afterJson: { changedFields },
        ip,
      });
    }

    return updatedTask;
  }

  // ---------------------------------------------------------------------
  // Vòng đời công việc: gia hạn / tạm ngừng / hủy / khôi phục
  // ---------------------------------------------------------------------

  private async getManagedTask(user: any, taskId: number) {
    const task = await this.prisma.task.findFirst({
      where: { AND: [{ id: taskId }, buildTaskAccessWhere(user)] },
      include: { createdBy: true, subTasks: true },
    });
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    if (!this.canManageTask(user, task)) {
      throw new ForbiddenException(
        'Chỉ người giao việc, Trưởng Ban / Trưởng dự án trong phạm vi, Ban Giám Đốc hoặc CEO mới có quyền thực hiện thao tác này',
      );
    }
    return task;
  }

  private requireReason(reason?: string): string {
    const text = (reason || '').trim();
    if (text.length < 5) {
      throw new BadRequestException('Vui lòng nhập lý do (tối thiểu 5 ký tự)');
    }
    return text;
  }

  private async notifyTaskTeam(
    task: any,
    actor: { id: number; name?: string },
    eventType: string,
    title: string,
    content: string,
  ) {
    const collaborators = Array.isArray(task.collaboratorIds)
      ? (task.collaboratorIds as number[])
      : [];
    const recipients = [
      ...new Set(
        [task.assigneeId, task.createdById, ...collaborators].filter(
          (id): id is number => typeof id === 'number' && id !== actor.id,
        ),
      ),
    ];
    await Promise.all(
      recipients.map((userId) =>
        this.notificationsService.dispatchNotification({
          userId,
          eventType,
          entityRef: `task:${task.id}`,
          title,
          content,
          link: `/tasks?id=${task.id}`,
          dedupeKey: `${eventType}_${task.id}_${userId}_${Date.now()}`,
        }),
      ),
    );
  }

  /** Trạng thái trước khi tạm ngừng / hủy (lấy từ nhật ký; dự phòng theo tiến độ). */
  private async previousStatusOf(task: any): Promise<string> {
    const log = await this.prisma.auditLog.findFirst({
      where: {
        entityType: 'task',
        entityId: task.id,
        action: { in: ['pause_task', 'cancel_task'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    const before = (log?.beforeJson as any)?.status;
    if (typeof before === 'string' && TASK_LIVE_STATUSES.includes(before)) {
      return before;
    }
    if (task.progressPercent >= 100) return TASK_STATUS.REVIEW;
    if (task.progressPercent > 0 || task.startDate) return TASK_STATUS.DOING;
    return TASK_STATUS.TODO;
  }

  /** Gia hạn: chỉ được lùi hạn hoàn thành, bắt buộc có lý do, lưu vết đầy đủ. */
  async extendTask(
    user: { id: number; name?: string; roles?: any; departmentId?: number | null },
    taskId: number,
    dto: ExtendTaskDto,
    ip?: string,
  ) {
    const task = await this.getManagedTask(user, taskId);
    if (isTaskInactive(task.status) && task.status !== TASK_STATUS.PAUSED) {
      throw new BadRequestException(
        'Chỉ gia hạn được công việc chưa hoàn thành hoặc đang tạm ngừng',
      );
    }
    const reason = this.requireReason(dto.reason);
    const newDue = new Date(dto.dueDate);
    if (Number.isNaN(newDue.getTime())) {
      throw new BadRequestException('Hạn hoàn thành mới không hợp lệ');
    }
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (task.dueDate && newDue.getTime() <= new Date(task.dueDate).getTime()) {
      throw new BadRequestException(
        'Hạn mới phải sau hạn hiện tại. Nếu muốn rút ngắn hạn, hãy dùng chức năng Sửa công việc.',
      );
    }
    if (!task.dueDate && newDue.getTime() < startOfToday.getTime()) {
      throw new BadRequestException('Hạn mới không được nằm trong quá khứ');
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { dueDate: newDue },
    });
    const fmt = (d?: Date | string | null) =>
      d ? new Date(d).toLocaleDateString('vi-VN') : 'chưa đặt hạn';
    const summary = `${fmt(task.dueDate)} → ${fmt(newDue)}`;
    await this.prisma.comment.create({
      data: {
        entityType: 'task',
        entityId: taskId,
        userId: user.id,
        content: `🗓️ Gia hạn công việc: ${summary}. Lý do: ${reason}`,
      },
    });
    await this.auditService.logEvent({
      entityType: 'task',
      entityId: taskId,
      action: 'extend_task',
      actorId: user.id,
      beforeJson: { dueDate: task.dueDate },
      afterJson: { dueDate: newDue, reason },
      ip,
    });
    await this.notifyTaskTeam(
      task,
      user,
      'task_extended',
      `Công việc được gia hạn: ${task.code}`,
      `“${task.title}” được gia hạn ${summary}. Lý do: ${reason}`,
    );
    return updated;
  }

  /** Tạm ngừng: giữ nguyên tiến độ, ngừng nhắc việc / quá hạn, kéo theo các việc con chưa xong. */
  async pauseTask(
    user: { id: number; name?: string; roles?: any; departmentId?: number | null },
    taskId: number,
    dto: TaskReasonDto,
    ip?: string,
  ) {
    const task = await this.getManagedTask(user, taskId);
    if (!TASK_LIVE_STATUSES.includes(task.status)) {
      throw new BadRequestException(
        'Chỉ tạm ngừng được công việc đang thực hiện (chưa hoàn thành, chưa hủy)',
      );
    }
    const reason = this.requireReason(dto.reason);
    const affectedChildren = (task.subTasks || []).filter((child: any) =>
      TASK_LIVE_STATUSES.includes(child.status),
    );

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { status: TASK_STATUS.PAUSED },
    });
    for (const child of affectedChildren) {
      await this.prisma.task.update({
        where: { id: child.id },
        data: { status: TASK_STATUS.PAUSED },
      });
      await this.auditService.logEvent({
        entityType: 'task',
        entityId: child.id,
        action: 'pause_task',
        actorId: user.id,
        beforeJson: { status: child.status },
        afterJson: { status: TASK_STATUS.PAUSED, reason, cascadeFrom: taskId },
        ip,
      });
    }
    await this.prisma.comment.create({
      data: {
        entityType: 'task',
        entityId: taskId,
        userId: user.id,
        content: `⏸️ Tạm ngừng công việc. Lý do: ${reason}`,
      },
    });
    await this.auditService.logEvent({
      entityType: 'task',
      entityId: taskId,
      action: 'pause_task',
      actorId: user.id,
      beforeJson: { status: task.status },
      afterJson: { status: TASK_STATUS.PAUSED, reason },
      ip,
    });
    await this.notifyTaskTeam(
      task,
      user,
      'task_paused',
      `Công việc tạm ngừng: ${task.code}`,
      `“${task.title}” được tạm ngừng. Lý do: ${reason}`,
    );
    return updated;
  }

  /** Hủy: đóng công việc (và các việc con chưa xong), không sinh kỳ lặp, không tính vào tỷ lệ hoàn thành. */
  async cancelTask(
    user: { id: number; name?: string; roles?: any; departmentId?: number | null },
    taskId: number,
    dto: TaskReasonDto,
    ip?: string,
  ) {
    const task = await this.getManagedTask(user, taskId);
    if (
      task.status === TASK_STATUS.DONE ||
      task.status === TASK_STATUS.CANCELLED
    ) {
      throw new BadRequestException(
        'Công việc đã hoàn thành hoặc đã hủy nên không thể hủy',
      );
    }
    const reason = this.requireReason(dto.reason);
    const affectedChildren = (task.subTasks || []).filter(
      (child: any) =>
        child.status !== TASK_STATUS.DONE &&
        child.status !== TASK_STATUS.CANCELLED,
    );

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { status: TASK_STATUS.CANCELLED },
    });
    for (const child of affectedChildren) {
      await this.prisma.task.update({
        where: { id: child.id },
        data: { status: TASK_STATUS.CANCELLED },
      });
      await this.auditService.logEvent({
        entityType: 'task',
        entityId: child.id,
        action: 'cancel_task',
        actorId: user.id,
        beforeJson: {
          status: TASK_LIVE_STATUSES.includes(child.status)
            ? child.status
            : await this.previousStatusOf(child),
        },
        afterJson: {
          status: TASK_STATUS.CANCELLED,
          reason,
          cascadeFrom: taskId,
        },
        ip,
      });
    }
    await this.prisma.comment.create({
      data: {
        entityType: 'task',
        entityId: taskId,
        userId: user.id,
        content: `🚫 Hủy công việc. Lý do: ${reason}`,
      },
    });
    await this.auditService.logEvent({
      entityType: 'task',
      entityId: taskId,
      action: 'cancel_task',
      actorId: user.id,
      beforeJson: {
        status: TASK_LIVE_STATUSES.includes(task.status)
          ? task.status
          : await this.previousStatusOf(task),
      },
      afterJson: { status: TASK_STATUS.CANCELLED, reason },
      ip,
    });
    if (task.parentTaskId) {
      await this.recalculateParentProgress(task.parentTaskId);
    }
    await this.notifyTaskTeam(
      task,
      user,
      'task_cancelled',
      `Công việc đã hủy: ${task.code}`,
      `“${task.title}” đã bị hủy. Lý do: ${reason}`,
    );
    return updated;
  }

  /** Tiếp tục (từ tạm ngừng) hoặc khôi phục (từ đã hủy) về đúng trạng thái trước đó. */
  async resumeTask(
    user: { id: number; name?: string; roles?: any; departmentId?: number | null },
    taskId: number,
    dto: TaskReasonDto,
    ip?: string,
  ) {
    const task = await this.getManagedTask(user, taskId);
    if (
      task.status !== TASK_STATUS.PAUSED &&
      task.status !== TASK_STATUS.CANCELLED
    ) {
      throw new BadRequestException(
        'Chỉ tiếp tục / khôi phục được công việc đang tạm ngừng hoặc đã hủy',
      );
    }
    const wasCancelled = task.status === TASK_STATUS.CANCELLED;
    const note = (dto.reason || '').trim();
    const restoredStatus = await this.previousStatusOf(task);
    const sameStateChildren = (task.subTasks || []).filter(
      (child: any) => child.status === task.status,
    );

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { status: restoredStatus },
    });
    for (const child of sameStateChildren) {
      const childStatus = await this.previousStatusOf(child);
      await this.prisma.task.update({
        where: { id: child.id },
        data: { status: childStatus },
      });
      await this.auditService.logEvent({
        entityType: 'task',
        entityId: child.id,
        action: 'resume_task',
        actorId: user.id,
        beforeJson: { status: child.status },
        afterJson: { status: childStatus, cascadeFrom: taskId },
        ip,
      });
    }
    if (sameStateChildren.length > 0) {
      await this.recalculateParentProgress(taskId);
    }
    await this.prisma.comment.create({
      data: {
        entityType: 'task',
        entityId: taskId,
        userId: user.id,
        content: `${wasCancelled ? '♻️ Khôi phục công việc' : '▶️ Tiếp tục công việc'}${note ? `. Ghi chú: ${note}` : ''}`,
      },
    });
    await this.auditService.logEvent({
      entityType: 'task',
      entityId: taskId,
      action: 'resume_task',
      actorId: user.id,
      beforeJson: { status: task.status },
      afterJson: { status: restoredStatus, note },
      ip,
    });
    if (task.parentTaskId) {
      await this.recalculateParentProgress(task.parentTaskId);
    }
    await this.notifyTaskTeam(
      task,
      user,
      'task_resumed',
      `Công việc được tiếp tục: ${task.code}`,
      `“${task.title}” ${wasCancelled ? 'đã được khôi phục' : 'được tiếp tục thực hiện'}.`,
    );
    return updated;
  }

  /**
   * Người thực hiện chính thức nhận việc trước khi cập nhật tiến độ.
   */
  async acceptTask(user: { id: number }, taskId: number, ip?: string) {
    const task = await this.prisma.task.findFirst({
      where: { AND: [{ id: taskId }, buildTaskAccessWhere(user)] },
    });

    if (!task) {
      throw new NotFoundException('Không tìm thấy công việc');
    }
    if (task.assigneeId !== user.id) {
      throw new ForbiddenException(
        'Chỉ người thực hiện chính được quyền nhận công việc này',
      );
    }
    if (isTaskInactive(task.status) && task.status !== TASK_STATUS.DONE) {
      throw new BadRequestException(
        task.status === TASK_STATUS.PAUSED
          ? 'Công việc đang tạm ngừng, chưa thể nhận việc'
          : 'Công việc đã hủy',
      );
    }
    if (task.status !== 'Chưa làm') {
      throw new BadRequestException('Công việc đã được nhận hoặc đã xử lý');
    }

    const acceptedAt = new Date();
    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'Đang làm',
        startDate: task.startDate || acceptedAt,
      },
    });

    if (task.createdById !== user.id) {
      await this.notificationsService.dispatchNotification({
        userId: task.createdById,
        eventType: 'task_accepted',
        entityRef: `task:${taskId}`,
        title: `Công việc đã được nhận: ${task.code}`,
        content: `Người thực hiện đã nhận việc "${task.title}" và bắt đầu xử lý.`,
        link: `/tasks?id=${taskId}`,
        dedupeKey: `task_accepted_${taskId}_${user.id}`,
      });
    }

    await this.auditService.logEvent({
      entityType: 'task',
      entityId: taskId,
      action: 'accept_task',
      actorId: user.id,
      beforeJson: { status: task.status, startDate: task.startDate },
      afterJson: { status: 'Đang làm', startDate: updatedTask.startDate },
      ip,
    });

    return updatedTask;
  }

  /**
   * Cập nhật tiến độ (%) và tự động chuyển trạng thái
   */
  async updateProgress(
    user: { id: number; roles?: string[]; departmentId?: number | null },
    taskId: number,
    dto: UpdateProgressDto,
    ip?: string,
  ) {
    const task = await this.prisma.task.findFirst({
      where: { AND: [{ id: taskId }, buildTaskAccessWhere(user)] },
      include: {
        subTasks: true,
        parentTask: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Không tìm thấy công việc');
    }

    if (task.assigneeId !== user.id) {
      throw new ForbiddenException(
        'Chỉ người thực hiện chính được cập nhật tiến độ công việc',
      );
    }
    if (task.status === TASK_STATUS.PAUSED) {
      throw new BadRequestException(
        'Công việc đang tạm ngừng, chưa thể cập nhật tiến độ',
      );
    }
    if (task.status === TASK_STATUS.CANCELLED) {
      throw new BadRequestException('Công việc đã hủy, không thể cập nhật tiến độ');
    }
    if (task.status === 'Chưa làm') {
      throw new BadRequestException(
        'Vui lòng bấm Nhận việc trước khi cập nhật tiến độ',
      );
    }

    // Điểm chốt 1: Khóa không cho nhập tay trực tiếp trên việc cha khi đã có con
    if (task.subTasks && task.subTasks.length > 0) {
      throw new BadRequestException(
        'Công việc có việc con không được cập nhật tiến độ trực tiếp; tiến độ được tự động tính từ các việc con',
      );
    }

    // Tự động xác định trạng thái theo %
    let newStatus = task.status;
    if (dto.progressPercent === 100) {
      newStatus = 'Chờ duyệt';
    } else if (dto.progressPercent >= 0) {
      newStatus = 'Đang làm';
    }

    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        progressPercent: dto.progressPercent,
        status: newStatus,
      },
    });

    // Nếu có ghi chú tiến độ, lưu thành bình luận
    if (dto.note) {
      await this.prisma.comment.create({
        data: {
          entityType: 'task',
          entityId: taskId,
          userId: user.id,
          content: `Cập nhật tiến độ: ${dto.progressPercent}% - ${dto.note}`,
        },
      });
    }

    // Nếu đạt 100% (chuyển Chờ duyệt) -> thông báo cho người giao việc
    if (dto.progressPercent === 100 && task.createdById !== user.id) {
      await this.notificationsService.dispatchNotification({
        userId: task.createdById,
        eventType: 'task_pending_approval',
        entityRef: `task:${taskId}`,
        title: `Công việc chờ nghiệm thu: ${task.code}`,
        content: `"${task.title}" đã đạt 100% tiến độ, đang chờ bạn xác nhận hoàn thành.`,
        link: `/tasks?id=${taskId}`,
        dedupeKey: `task_pending_${taskId}_${Date.now()}`,
      });
    }

    // Tự động tính lại tiến độ của việc cha (nếu có parentTaskId)
    if (task.parentTaskId) {
      await this.recalculateParentProgress(task.parentTaskId);
    }

    if (ip) {
      await this.auditService.logEvent({
        entityType: 'task',
        entityId: taskId,
        action: 'update_progress',
        actorId: user.id,
        afterJson: { progressPercent: dto.progressPercent, status: newStatus },
        ip,
      });
    }

    return updatedTask;
  }

  /**
   * Tự động tính trung bình cộng tiến độ từ việc con cho việc cha
   */
  async recalculateParentProgress(parentTaskId: number) {
    const parent = await this.prisma.task.findUnique({
      where: { id: parentTaskId },
      select: { status: true },
    });
    if (parent && isTaskInactive(parent.status) && parent.status !== 'Hoàn thành') {
      return;
    }
    const subTasks = await this.prisma.task.findMany({
      where: { parentTaskId, status: { not: TASK_STATUS.CANCELLED } },
      select: { progressPercent: true, status: true },
    });

    if (subTasks.length === 0) return;

    const total = subTasks.reduce((sum, st) => sum + st.progressPercent, 0);
    const avgProgress = Math.round(total / subTasks.length);

    let parentStatus = 'Đang làm';
    if (avgProgress === 100) {
      parentStatus = 'Chờ duyệt';
    } else if (avgProgress === 0) {
      parentStatus = 'Chưa làm';
    }

    await this.prisma.task.update({
      where: { id: parentTaskId },
      data: {
        progressPercent: avgProgress,
        status: parentStatus,
      },
    });
  }

  /**
   * Xác nhận hoàn thành công việc (chỉ người giao việc hoặc CEO)
   * Chống double-submit và sinh kỳ lặp tiếp theo
   */
  async confirmCompletion(
    user: { id: number; roles?: Array<string | { name: string }> },
    taskId: number,
    ip?: string,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        createdBy: true,
        assignee: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Không tìm thấy công việc');
    }

    // 1. CHỐNG DOUBLE-SUBMIT: Kiểm tra status !== 'Chờ duyệt' ngay đầu hàm
    if (task.status !== 'Chờ duyệt') {
      throw new BadRequestException(
        'Chỉ công việc đang ở trạng thái "Chờ duyệt" mới có thể xác nhận hoàn thành',
      );
    }

    // 2. Phân quyền: Chỉ người giao việc hoặc CEO mới được xác nhận
    const isCreator = task.createdById === user.id;
    const isCeo = this.hasRole(user, 'ceo');
    if (!isCreator && !isCeo) {
      throw new ForbiddenException(
        'Chỉ người giao việc mới có quyền xác nhận hoàn thành công việc',
      );
    }

    return this.prisma
      .$transaction(async (tx) => {
        // Cập nhật trạng thái Hoàn thành
        const updated = await tx.task.update({
          where: { id: taskId },
          data: {
            status: 'Hoàn thành',
            progressPercent: 100,
          },
        });

        await this.auditService.logEvent({
          entityType: 'task',
          entityId: taskId,
          action: 'confirm_completion',
          actorId: user.id,
          beforeJson: {
            status: task.status,
            progressPercent: task.progressPercent,
          },
          afterJson: { status: 'Hoàn thành', progressPercent: 100 },
          ip,
        });

        // Nếu có chu kỳ lặp lại (recurrenceRule) và dueDate -> sinh kỳ mới
        let nextTask = null;
        if (task.recurrenceRule && task.dueDate) {
          const nextDueDate = calculateNextDueDate(
            new Date(task.dueDate),
            task.recurrenceRule,
            new Date(),
          );

          let nextStartDate: Date | null = null;
          if (task.startDate) {
            const duration =
              new Date(task.dueDate).getTime() -
              new Date(task.startDate).getTime();
            nextStartDate = new Date(nextDueDate.getTime() - duration);
          }

          const nextCode = await this.generateTaskCode();

          nextTask = await tx.task.create({
            data: {
              code: nextCode,
              title: task.title,
              description: task.description,
              priority: task.priority,
              status: 'Chưa làm',
              progressPercent: 0,
              startDate: nextStartDate,
              dueDate: nextDueDate,
              assigneeId: task.assigneeId,
              createdById: task.createdById,
              parentTaskId: null,
              recurrenceRule: task.recurrenceRule,
              projectId: task.projectId,
              linkedProjectIds: task.linkedProjectIds || [],
              tags: task.tags,
              collaboratorIds: (task.collaboratorIds as any) ?? undefined,
              visibility: task.visibility,
            },
          });
        }

        return { task: updated, nextTask };
      })
      .then(async (result) => {
        // Bắn notification NGOÀI transaction — dispatchNotification gọi cả email/web-push
        // (network I/O), không nên giữ transaction DB mở trong lúc chờ mạng.
        if (result.nextTask && task.assigneeId) {
          await this.notificationsService.dispatchNotification({
            userId: task.assigneeId,
            eventType: 'task_recurring_created',
            entityRef: `task:${result.nextTask.id}`,
            title: `Kỳ việc mới: ${result.nextTask.code}`,
            content: `Việc lặp lại "${result.nextTask.title}" đã tự động sinh kỳ tiếp theo, hạn hoàn thành ${result.nextTask.dueDate ? new Date(result.nextTask.dueDate).toLocaleDateString('vi-VN') : 'chưa xác định'}.`,
            link: `/tasks?id=${result.nextTask.id}`,
            dedupeKey: `task_recurring_${result.nextTask.id}_${task.assigneeId}_${Date.now()}`,
          });
        }
        return result;
      });
  }

  /**
   * Lấy danh sách công việc theo tab và các tiêu chí lọc
   */
  async findAll(
    user: {
      id: number;
      roles?: Array<string | { name: string }>;
      departmentId?: number | null;
    },
    query: TaskQueryDto,
  ) {
    const { tab = 'all', status, priority, search, isOverdue, tags } = query;
    const where: any = {};
    const andConditions: any[] = [];
    if (!search) andConditions.push({ parentTaskId: null });

    // 1. Phân loại theo 4 Tabs
    if (tab === 'assigned_to_me') {
      // "Việc tôi làm" bao gồm cả người thực hiện chính và người phối hợp.
      andConditions.push({
        OR: [
          { assigneeId: user.id },
          { collaboratorIds: { array_contains: [user.id] } },
        ],
      });
    } else if (tab === 'assigned_by_me') {
      andConditions.push({ createdById: user.id });
    } else if (tab === 'department') {
      const roles = getRoleNames(user);
      if (!roles.includes('department_head') && !roles.includes('ceo')) {
        return [];
      }
      andConditions.push(buildTaskAccessWhere(user));
    } else {
      andConditions.push(buildTaskAccessWhere(user));
    }

    // 2. Filter trạng thái, độ ưu tiên, tag, từ khóa
    if (status) {
      where.status = status;
    }
    if (priority) {
      where.priority = priority;
    }
    if (tags) {
      where.tags = { contains: tags, mode: 'insensitive' };
    }
    if (query.projectId) {
      andConditions.push({
        OR: [
          { projectId: query.projectId },
          { linkedProjectIds: { array_contains: [query.projectId] } },
        ],
      });
    }
    if (search) {
      const searchCondition = {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ],
      };
      andConditions.push(searchCondition);
    }
    if (andConditions.length > 0) where.AND = andConditions;

    const tasks = await this.prisma.task.findMany({
      relationLoadStrategy: 'join',
      where,
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            departmentId: true,
            avatarUrl: true,
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true, departmentId: true },
        },
        subTasks: {
          include: {
            assignee: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        project: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Tính runtime cờ isOverdue
    const now = new Date();
    const tasksWithOverdue = tasks.map((t) => {
      const isTaskOverdue =
        !isTaskInactive(t.status) &&
        t.dueDate !== null &&
        new Date(t.dueDate) < now;
      return {
        ...t,
        isOverdue: isTaskOverdue,
      };
    });

    if (isOverdue === 'true') {
      return tasksWithOverdue.filter((t) => t.isOverdue);
    }

    return tasksWithOverdue;
  }

  /**
   * Xem chi tiết công việc
   */
  async findById(
    user: {
      id: number;
      roles?: Array<string | { name: string }>;
      departmentId?: number | null;
    },
    taskId: number,
  ) {
    const task = await this.prisma.task.findFirst({
      relationLoadStrategy: 'join',
      where: { AND: [{ id: taskId }, buildTaskAccessWhere(user)] },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            departmentId: true,
            avatarUrl: true,
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true, departmentId: true },
        },
        parentTask: {
          select: { id: true, code: true, title: true, status: true },
        },
        subTasks: {
          include: {
            assignee: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        project: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Không tìm thấy công việc');
    }

    const viewedAt = new Date();
    await this.prisma.taskView.upsert({
      where: { taskId_userId: { taskId, userId: user.id } },
      create: {
        taskId,
        userId: user.id,
        firstViewedAt: viewedAt,
        lastViewedAt: viewedAt,
      },
      update: {
        lastViewedAt: viewedAt,
        viewCount: { increment: 1 },
      },
    });

    const viewers = await this.prisma.taskView.findMany({
      where: { taskId },
      orderBy: { lastViewedAt: 'desc' },
      select: {
        firstViewedAt: true,
        lastViewedAt: true,
        viewCount: true,
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    // Lấy attachments
    const attachments = await this.prisma.attachment.findMany({
      where: { entityType: 'task', entityId: taskId },
      orderBy: { uploadedAt: 'desc' },
    });

    // Lấy comments
    const comments = await this.prisma.comment.findMany({
      where: { entityType: 'task', entityId: taskId },
      orderBy: { createdAt: 'asc' },
    });

    // Lấy thông tin user của các comment
    const userIds = [...new Set(comments.map((c) => c.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const commentsWithUser = comments.map((c) => ({
      ...c,
      user: userMap.get(c.userId) || {
        id: c.userId,
        name: 'Người dùng',
        email: '',
      },
    }));

    // Tính runtime isOverdue cho task và subtasks
    const now = new Date();
    const isOverdue =
      !isTaskInactive(task.status) &&
      task.dueDate !== null &&
      new Date(task.dueDate) < now;

    const subTasksWithOverdue = task.subTasks.map((st) => ({
      ...st,
      isOverdue:
        !isTaskInactive(st.status) &&
        st.dueDate !== null &&
        new Date(st.dueDate) < now,
    }));

    return {
      ...task,
      isOverdue,
      subTasks: subTasksWithOverdue,
      attachments,
      comments: commentsWithUser,
      viewers,
    };
  }

  /**
   * Thêm bình luận và xử lý mention bắn notification in-app
   */
  async addComment(
    user: {
      id: number;
      name: string;
      roles?: Array<string | { name: string }>;
    },
    taskId: number,
    dto: CreateCommentDto,
  ) {
    const task = await this.prisma.task.findFirst({
      where: { AND: [{ id: taskId }, buildTaskAccessWhere(user)] },
    });
    if (!task) {
      throw new NotFoundException('Không tìm thấy công việc');
    }

    const comment = await this.prisma.comment.create({
      data: {
        entityType: 'task',
        entityId: taskId,
        userId: user.id,
        content: dto.content,
        mentions: dto.mentions || [],
      },
    });

    // Nếu có mentions, bắn notification với dedupeKey duy nhất
    if (
      dto.mentions &&
      Array.isArray(dto.mentions) &&
      dto.mentions.length > 0
    ) {
      for (const mentionedId of dto.mentions) {
        if (mentionedId !== user.id) {
          await this.notificationsService.dispatchNotification({
            userId: mentionedId,
            eventType: 'task_comment_mention',
            entityRef: `task:${taskId}`,
            title: `${user.name} đã nhắc đến bạn`,
            content: `Trong công việc "${task.title}": ${dto.content}`,
            link: `/tasks?id=${taskId}`,
            dedupeKey: `task_mention_${comment.id}_${mentionedId}_${Date.now()}`,
          });
        }
      }
    }

    return {
      ...comment,
      user: { id: user.id, name: user.name },
    };
  }
}
