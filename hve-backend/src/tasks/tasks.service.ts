import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { UpdateProgressDto } from './dto/update-progress.dto.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { TaskQueryDto } from './dto/task-query.dto.js';

/**
 * Helper: Cộng thêm `months` tháng an toàn, chống tràn ngày cuối tháng (VD: 31/01 -> 28/02)
 */
export function addMonthsSafe(date: Date, months: number): Date {
  const d = date.getDate();
  const result = new Date(date.getTime());
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const maxDays = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
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
  ) {}

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
  async getAssignableUsers() {
    return this.prisma.user.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        name: true,
        email: true,
        departmentId: true,
        department: { select: { id: true, name: true, code: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Tạo công việc mới (có thể là việc cha hoặc việc con)
   */
  async createTask(
    user: { id: number; name: string },
    dto: CreateTaskDto,
    ip?: string,
  ) {
    // 1. Kiểm tra giới hạn 2 cấp công việc
    if (dto.parentTaskId) {
      const parent = await this.prisma.task.findUnique({
        where: { id: dto.parentTaskId },
      });
      if (!parent) {
        throw new NotFoundException('Không tìm thấy công việc cha');
      }
      if (parent.parentTaskId) {
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
      if (parent.recurrenceRule) {
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
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    // Nếu có file đính kèm, gắn vào task
    if (dto.attachmentIds && dto.attachmentIds.length > 0) {
      await this.prisma.attachment.updateMany({
        where: { id: { in: dto.attachmentIds } },
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
      await this.prisma.notification.create({
        data: {
          userId: dto.assigneeId,
          eventType: 'task_assigned',
          entityRef: `task:${task.id}`,
          channel: 'in_app',
          dedupeKey: `task_assign_${task.id}_${dto.assigneeId}_${Date.now()}`,
        },
      });
    }

    return task;
  }

  /**
   * Cập nhật thông tin công việc
   */
  async updateTask(
    user: { id: number; roles?: string[]; departmentId?: number | null },
    taskId: number,
    dto: UpdateTaskDto,
    ip?: string,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        createdBy: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Không tìm thấy công việc');
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
      const isCeo = user.roles?.includes('ceo');
      const isHeadOfCreatorDept =
        user.roles?.includes('department_head') &&
        user.departmentId &&
        task.createdBy?.departmentId &&
        user.departmentId === task.createdBy.departmentId;

      if (!isCreator && !isCeo && !isHeadOfCreatorDept) {
        throw new ForbiddenException(
          'Chỉ người giao việc, Trưởng bộ phận cùng phòng hoặc Ban Giám đốc mới có quyền thay đổi người thực hiện hoặc hạn hoàn thành',
        );
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
        title: dto.title ?? undefined,
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
    if (
      hasAssigneeChange &&
      dto.assigneeId &&
      dto.assigneeId !== user.id
    ) {
      await this.prisma.notification.create({
        data: {
          userId: dto.assigneeId,
          eventType: 'task_reassigned',
          entityRef: `task:${taskId}`,
          channel: 'in_app',
          dedupeKey: `task_reassigned_${taskId}_${dto.assigneeId}_${Date.now()}`,
        },
      });
    }

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
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        subTasks: true,
        parentTask: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Không tìm thấy công việc');
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
    } else if (dto.progressPercent > 0) {
      newStatus = 'Đang làm';
    } else if (dto.progressPercent === 0) {
      newStatus = 'Chưa làm';
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
      await this.prisma.notification.create({
        data: {
          userId: task.createdById,
          eventType: 'task_pending_approval',
          entityRef: `task:${taskId}`,
          channel: 'in_app',
          dedupeKey: `task_pending_${taskId}_${Date.now()}`,
        },
      });
    }

    // Tự động tính lại tiến độ của việc cha (nếu có parentTaskId)
    if (task.parentTaskId) {
      await this.recalculateParentProgress(task.parentTaskId);
    }

    return updatedTask;
  }

  /**
   * Tự động tính trung bình cộng tiến độ từ việc con cho việc cha
   */
  async recalculateParentProgress(parentTaskId: number) {
    const subTasks = await this.prisma.task.findMany({
      where: { parentTaskId },
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
    user: { id: number; roles?: string[] },
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
    const isCeo = user.roles?.includes('ceo');
    if (!isCreator && !isCeo) {
      throw new ForbiddenException(
        'Chỉ người giao việc mới có quyền xác nhận hoàn thành công việc',
      );
    }

    return this.prisma.$transaction(async (tx) => {
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
            new Date(task.dueDate).getTime() - new Date(task.startDate).getTime();
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
            tags: task.tags,
            collaboratorIds: (task.collaboratorIds as any) ?? undefined,
          },
        });

        if (task.assigneeId) {
          await tx.notification.create({
            data: {
              userId: task.assigneeId,
              eventType: 'task_recurring_created',
              entityRef: `task:${nextTask.id}`,
              channel: 'in_app',
              dedupeKey: `task_recurring_${nextTask.id}_${task.assigneeId}_${Date.now()}`,
            },
          });
        }
      }

      return { task: updated, nextTask };
    });
  }

  /**
   * Lấy danh sách công việc theo tab và các tiêu chí lọc
   */
  async findAll(
    user: { id: number; roles?: string[]; departmentId?: number | null },
    query: TaskQueryDto,
  ) {
    const { tab = 'all', status, priority, search, isOverdue, tags } = query;
    const where: any = {};

    // 1. Phân loại theo 4 Tabs
    if (tab === 'assigned_to_me') {
      where.assigneeId = user.id;
    } else if (tab === 'assigned_by_me') {
      where.createdById = user.id;
    } else if (tab === 'department') {
      // Lọc theo bộ phận của user
      if (!user.departmentId) {
        return [];
      }
      where.OR = [
        { assignee: { departmentId: user.departmentId } },
        { createdBy: { departmentId: user.departmentId } },
      ];
    } else {
      // Tab 'all'
      const isCeo = user.roles?.includes('ceo');
      if (!isCeo) {
        const orConditions: any[] = [
          { assigneeId: user.id },
          { createdById: user.id },
        ];
        if (user.departmentId) {
          orConditions.push(
            { assignee: { departmentId: user.departmentId } },
            { createdBy: { departmentId: user.departmentId } },
          );
        }
        where.OR = orConditions;
      }
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
    if (search) {
      const searchCondition = {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ],
      };
      if (where.AND) {
        where.AND.push(searchCondition);
      } else {
        where.AND = [searchCondition];
      }
    }

    const tasks = await this.prisma.task.findMany({
      where,
      include: {
        assignee: {
          select: { id: true, name: true, email: true, departmentId: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true, departmentId: true },
        },
        subTasks: {
          include: {
            assignee: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Tính runtime cờ isOverdue
    const now = new Date();
    const tasksWithOverdue = tasks.map((t) => {
      const isTaskOverdue =
        t.status !== 'Hoàn thành' &&
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
    user: { id: number; roles?: string[]; departmentId?: number | null },
    taskId: number,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, departmentId: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true, departmentId: true },
        },
        parentTask: {
          select: { id: true, code: true, title: true, status: true },
        },
        subTasks: {
          include: {
            assignee: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Không tìm thấy công việc');
    }

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
      user: userMap.get(c.userId) || { id: c.userId, name: 'Người dùng', email: '' },
    }));

    // Tính runtime isOverdue cho task và subtasks
    const now = new Date();
    const isOverdue =
      task.status !== 'Hoàn thành' &&
      task.dueDate !== null &&
      new Date(task.dueDate) < now;

    const subTasksWithOverdue = task.subTasks.map((st) => ({
      ...st,
      isOverdue:
        st.status !== 'Hoàn thành' &&
        st.dueDate !== null &&
        new Date(st.dueDate) < now,
    }));

    return {
      ...task,
      isOverdue,
      subTasks: subTasksWithOverdue,
      attachments,
      comments: commentsWithUser,
    };
  }

  /**
   * Thêm bình luận và xử lý mention bắn notification in-app
   */
  async addComment(
    user: { id: number; name: string },
    taskId: number,
    dto: CreateCommentDto,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
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
    if (dto.mentions && Array.isArray(dto.mentions) && dto.mentions.length > 0) {
      for (const mentionedId of dto.mentions) {
        if (mentionedId !== user.id) {
          await this.prisma.notification.create({
            data: {
              userId: mentionedId,
              eventType: 'task_comment_mention',
              entityRef: `task:${taskId}`,
              channel: 'in_app',
              dedupeKey: `task_mention_${comment.id}_${mentionedId}_${Date.now()}`,
            },
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
