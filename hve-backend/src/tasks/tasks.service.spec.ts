import { Test, TestingModule } from '@nestjs/testing';
import {
  TasksService,
  addMonthsSafe,
  calculateNextDueDate,
} from './tasks.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('TasksService', () => {
  let service: TasksService;
  let prisma: any;
  let auditService: any;
  let notificationsService: any;

  beforeEach(async () => {
    prisma = {
      task: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        groupBy: vi.fn(),
      },
      attachment: {
        count: vi.fn(),
        updateMany: vi.fn(),
        findMany: vi.fn(),
      },
      comment: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      notification: {
        create: vi.fn(),
      },
      user: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb(prisma)),
    };
    prisma.task.findFirst.mockImplementation((args: any) =>
      prisma.task.findUnique(args),
    );

    auditService = {
      logEvent: vi.fn().mockResolvedValue({ id: 1 }),
    };

    notificationsService = {
      dispatchNotification: vi.fn().mockResolvedValue({ in_app: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  describe('Date Helpers', () => {
    it('addMonthsSafe should prevent month spill-over (31 Jan -> 28 Feb in non-leap year)', () => {
      const jan31 = new Date(2026, 0, 31); // 31/01/2026
      const febResult = addMonthsSafe(jan31, 1);
      expect(febResult.getFullYear()).toBe(2026);
      expect(febResult.getMonth()).toBe(1); // February
      expect(febResult.getDate()).toBe(28); // 28th Feb
    });

    it('addMonthsSafe should handle 31 March + 1 month -> 30 April', () => {
      const mar31 = new Date(2026, 2, 31);
      const aprResult = addMonthsSafe(mar31, 1);
      expect(aprResult.getMonth()).toBe(3); // April
      expect(aprResult.getDate()).toBe(30);
    });

    it('calculateNextDueDate should round-forward past dueDates to future (>= now)', () => {
      // Giả sử dueDate cũ là 21 ngày trước, recurrence là weekly
      const now = new Date('2026-09-16T10:00:00Z');
      const pastDueDate = new Date('2026-08-26T10:00:00Z');

      const nextDue = calculateNextDueDate(pastDueDate, 'weekly', now);
      expect(nextDue.getTime()).toBeGreaterThanOrEqual(now.getTime());
      // Phải rơi vào đúng ngày trong tuần (Thứ 4)
      expect(nextDue.getUTCDay()).toBe(pastDueDate.getUTCDay());
    });
  });

  describe('generateTaskCode', () => {
    it('should generate CV-YYYY-001 if no task exists', async () => {
      prisma.task.findFirst.mockResolvedValue(null);
      const code = await service.generateTaskCode();
      const currentYear = new Date().getFullYear();
      expect(code).toBe(`CV-${currentYear}-001`);
    });

    it('should increment sequence from latest task', async () => {
      const currentYear = new Date().getFullYear();
      prisma.task.findFirst.mockResolvedValue({
        code: `CV-${currentYear}-007`,
      });
      const code = await service.generateTaskCode();
      expect(code).toBe(`CV-${currentYear}-008`);
    });
  });

  describe('getWorkloadSummary', () => {
    it('uses grouped counts and includes assignable people with zero open tasks', async () => {
      prisma.task.groupBy
        .mockResolvedValueOnce([
          { assigneeId: 2, _count: { _all: 7 } },
          { assigneeId: 3, _count: { _all: 3 } },
        ])
        .mockResolvedValueOnce([{ assigneeId: 2, _count: { _all: 2 } }]);
      prisma.user.findMany.mockResolvedValue([
        { id: 2, name: 'Quá tải', email: 'busy@hve.vn' },
        { id: 3, name: 'Vừa sức', email: 'medium@hve.vn' },
        { id: 4, name: 'Đang rảnh', email: 'free@hve.vn' },
      ]);

      const result = await service.getWorkloadSummary(
        { id: 1, roles: ['ceo'] },
        9,
      );

      expect(prisma.task.groupBy).toHaveBeenCalledTimes(2);
      expect(result).toEqual([
        expect.objectContaining({
          userId: 2,
          activeCount: 7,
          overdueCount: 2,
          level: 'qua_tai',
        }),
        expect.objectContaining({ userId: 3, activeCount: 3, level: 'vua' }),
        expect.objectContaining({ userId: 4, activeCount: 0, level: 'ranh' }),
      ]);
      expect(prisma.task.groupBy.mock.calls[0][0].where.AND).toContainEqual({
        projectId: 9,
      });
    });
  });

  describe('createTask', () => {
    it('should create independent task and send notification if assigned to another user', async () => {
      prisma.task.findFirst.mockResolvedValue(null);
      prisma.task.create.mockResolvedValue({
        id: 1,
        code: 'CV-2026-001',
        title: 'Làm báo cáo',
        assigneeId: 2,
        createdById: 1,
      });

      prisma.user.findFirst.mockResolvedValue({ departmentId: 10 });
      const user = {
        id: 1,
        name: 'Nguyễn Văn A',
        roles: ['department_head'],
        departmentId: 10,
      };
      const dto: any = {
        title: 'Làm báo cáo',
        assigneeId: 2,
        priority: 'high',
      };

      const result = await service.createTask(user, dto);
      expect(result.id).toBe(1);
      expect(prisma.task.create).toHaveBeenCalled();
      expect(notificationsService.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 2,
          eventType: 'task_assigned',
        }),
      );
      expect(auditService.logEvent).toHaveBeenCalled();
    });

    it('should reject task creation by a regular employee', async () => {
      await expect(
        service.createTask(
          { id: 1, name: 'Nhân viên', roles: ['employee'] },
          { title: 'Không được phép giao' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lets BGĐ target one user or publish company-wide without changing legacy scope', async () => {
      prisma.task.findFirst.mockResolvedValue(null);
      prisma.task.create
        .mockResolvedValueOnce({
          id: 20,
          code: 'CV-2026-020',
          title: 'Việc gửi riêng',
          assigneeId: 2,
          createdById: 8,
        })
        .mockResolvedValueOnce({
          id: 21,
          code: 'CV-2026-021',
          title: 'Việc toàn công ty',
          assigneeId: null,
          createdById: 8,
        });

      const boardUser = { id: 8, name: 'Ban Giám Đốc', roles: ['bgd'] };
      await service.createTask(boardUser, {
        title: 'Việc gửi riêng',
        assigneeId: 2,
      });
      await service.createTask(boardUser, { title: 'Việc toàn công ty' });

      expect(prisma.task.create.mock.calls[0][0].data.visibility).toBe(
        'targeted',
      );
      expect(prisma.task.create.mock.calls[1][0].data.visibility).toBe(
        'company',
      );
    });

    it('should reject creating subtask if parent task is already a subtask (max 2 levels)', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 10,
        parentTaskId: 5, // Already a subtask
      });

      await expect(
        service.createTask(
          { id: 1, name: 'User 1', roles: ['department_head'] },
          { title: 'Sub-subtask', parentTaskId: 10 },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject recurrenceRule on a subtask', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 5,
        parentTaskId: null,
      });

      await expect(
        service.createTask(
          { id: 1, name: 'User 1', roles: ['department_head'] },
          {
            title: 'Subtask with recurrence',
            parentTaskId: 5,
            recurrenceRule: 'daily',
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject adding subtask to a recurring parent task', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 5,
        parentTaskId: null,
        recurrenceRule: 'weekly',
      });

      await expect(
        service.createTask(
          { id: 1, name: 'User 1', roles: ['department_head'] },
          { title: 'Subtask of recurring', parentTaskId: 5 },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateTask & Permissions', () => {
    it('department head creator should be allowed to change assignee and dueDate, and audit log is recorded', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 1,
        createdById: 1,
        assigneeId: 2,
        dueDate: new Date('2026-09-20'),
        createdBy: { departmentId: 10 },
      });
      prisma.task.update.mockResolvedValue({ id: 1, assigneeId: 3 });

      const user = { id: 1, roles: ['department_head'], departmentId: 10 };
      await service.updateTask(user, 1, { assigneeId: 3 });

      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'reassign_or_reschedule',
        }),
      );
      expect(prisma.task.update).toHaveBeenCalled();
    });

    it('employee creator should not be allowed to reassign a legacy task', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 1,
        createdById: 1,
        assigneeId: 2,
        dueDate: new Date('2026-09-20'),
        createdBy: { departmentId: 10 },
      });

      await expect(
        service.updateTask(
          { id: 1, roles: ['employee'], departmentId: 10 },
          1,
          { assigneeId: 3 },
        ),
      ).rejects.toThrow('Ban Giám Đốc hoặc CEO');
    });

    it('unauthorized user should be forbidden from changing assignee or dueDate', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 1,
        createdById: 1,
        assigneeId: 2,
        dueDate: new Date('2026-09-20'),
        createdBy: { departmentId: 10 },
      });

      // User 99 from department 20 trying to change assignee
      const user = { id: 99, roles: ['employee'], departmentId: 20 };
      await expect(
        service.updateTask(user, 1, { assigneeId: 3 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject setting recurrenceRule on a task that already has subtasks', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 1,
        parentTaskId: null,
        subTasks: [{ id: 2 }],
        createdById: 1,
        createdBy: { departmentId: 10 },
      });

      const user = { id: 1, roles: ['employee'], departmentId: 10 };
      await expect(
        service.updateTask(user, 1, { recurrenceRule: 'weekly' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject setting recurrenceRule on a subtask in updateTask', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 2,
        parentTaskId: 1,
        subTasks: [],
        createdById: 1,
        createdBy: { departmentId: 10 },
      });

      const user = { id: 1, roles: ['employee'], departmentId: 10 };
      await expect(
        service.updateTask(user, 2, { recurrenceRule: 'weekly' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateProgress & Progress Calculation', () => {
    it('allows only the primary assignee to accept a new task', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 8,
        code: 'CV-2026-008',
        title: 'Chuẩn bị hồ sơ',
        status: 'Chưa làm',
        startDate: null,
        assigneeId: 5,
        createdById: 1,
      });
      prisma.task.update.mockImplementation(async ({ data }: any) => ({
        id: 8,
        ...data,
      }));

      const result = await service.acceptTask({ id: 5 }, 8, '127.0.0.1');

      expect(result.status).toBe('Đang làm');
      expect(result.startDate).toBeInstanceOf(Date);
      expect(notificationsService.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          eventType: 'task_accepted',
        }),
      );
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'accept_task', actorId: 5 }),
      );
    });

    it('rejects acceptance by someone other than the primary assignee', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 8,
        status: 'Chưa làm',
        assigneeId: 5,
        createdById: 1,
      });

      await expect(service.acceptTask({ id: 6 }, 8)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('should disallow direct progress update on parent task that has subtasks', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 1,
        assigneeId: 1,
        status: 'Đang làm',
        subTasks: [{ id: 2 }],
      });

      await expect(
        service.updateProgress({ id: 1 }, 1, { progressPercent: 50 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('updating progress on subtask should update parent progress automatically', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 2,
        parentTaskId: 1,
        subTasks: [],
        createdById: 10,
        assigneeId: 2,
        status: 'Đang làm',
      });
      prisma.task.update.mockResolvedValue({
        id: 2,
        progressPercent: 100,
        status: 'Chờ duyệt',
      });

      // Parent has 2 subtasks: one 100% and one 50%
      prisma.task.findMany.mockResolvedValue([
        { progressPercent: 100, status: 'Chờ duyệt' },
        { progressPercent: 50, status: 'Đang làm' },
      ]);

      await service.updateProgress({ id: 2 }, 2, { progressPercent: 100 });

      // Parent progress should be round((100 + 50) / 2) = 75%, status 'Đang làm'
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { progressPercent: 75, status: 'Đang làm' },
        }),
      );
    });

    it('setting progress to 100% should set status to "Chờ duyệt" and notify creator', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 2,
        parentTaskId: null,
        subTasks: [],
        createdById: 10,
        assigneeId: 5,
        status: 'Đang làm',
      });
      prisma.task.update.mockResolvedValue({
        id: 2,
        progressPercent: 100,
        status: 'Chờ duyệt',
      });

      await service.updateProgress({ id: 5 }, 2, { progressPercent: 100 });

      expect(notificationsService.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 10,
          eventType: 'task_pending_approval',
        }),
      );
    });

    it('requires the assignee to accept before updating progress', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 9,
        assigneeId: 5,
        status: 'Chưa làm',
        subTasks: [],
      });

      await expect(
        service.updateProgress({ id: 5 }, 9, { progressPercent: 25 }),
      ).rejects.toThrow('Vui lòng bấm Nhận việc');
      expect(prisma.task.update).not.toHaveBeenCalled();
    });
  });

  describe('confirmCompletion (Double-submit prevention & Recurrence)', () => {
    it('should reject confirmCompletion if status is NOT "Chờ duyệt" (prevents double submit)', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 1,
        status: 'Hoàn thành', // Already completed
        createdById: 10,
      });

      await expect(service.confirmCompletion({ id: 10 }, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject if user is not the task creator or CEO', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 1,
        status: 'Chờ duyệt',
        createdById: 10,
        assigneeId: 20,
      });

      // User 20 is the assignee, not creator
      await expect(
        service.confirmCompletion({ id: 20, roles: ['employee'] }, 1),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should complete task and spawn next recurring cycle if recurrenceRule exists', async () => {
      const initialDueDate = new Date('2026-09-15T17:00:00Z');
      const initialStartDate = new Date('2026-09-10T17:00:00Z');

      prisma.task.findUnique.mockResolvedValue({
        id: 1,
        status: 'Chờ duyệt',
        progressPercent: 100,
        createdById: 10,
        assigneeId: 20,
        recurrenceRule: 'weekly',
        dueDate: initialDueDate,
        startDate: initialStartDate,
        title: 'Họp giao ban tuần',
        priority: 'normal',
      });

      prisma.task.update.mockResolvedValue({
        id: 1,
        status: 'Hoàn thành',
        progressPercent: 100,
      });
      prisma.task.findFirst.mockResolvedValue({ code: 'CV-2026-001' });
      prisma.task.create.mockResolvedValue({
        id: 2,
        code: 'CV-2026-002',
        title: 'Họp giao ban tuần',
        status: 'Chưa làm',
      });

      const result = await service.confirmCompletion(
        { id: 10, roles: ['employee'] },
        1,
      );
      expect(result.task.status).toBe('Hoàn thành');
      expect(result.nextTask).toBeDefined();
      expect(prisma.task.create).toHaveBeenCalled();
      expect(notificationsService.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 20,
          eventType: 'task_recurring_created',
        }),
      );
    });
  });

  describe('findAll & Department Filtering', () => {
    it('tab "assigned_to_me" includes primary assignments and collaboration', async () => {
      prisma.task.findMany.mockResolvedValue([]);

      await service.findAll(
        { id: 5, departmentId: 2, roles: ['employee'] },
        { tab: 'assigned_to_me' },
      );

      const call = prisma.task.findMany.mock.calls[0][0];
      expect(JSON.stringify(call.where)).toContain(
        JSON.stringify({
          OR: [
            { assigneeId: 5 },
            { collaboratorIds: { array_contains: [5] } },
          ],
        }),
      );
    });

    it('tab "department" should filter by user department on both assignee and creator', async () => {
      prisma.task.findMany.mockResolvedValue([]);

      const user = { id: 5, departmentId: 2, roles: ['department_head'] };
      await service.findAll(user, { tab: 'department' });

      const call = prisma.task.findMany.mock.calls[0][0];
      expect(JSON.stringify(call.where)).toContain(
        JSON.stringify({ assignee: { departmentId: 2 } }),
      );
      expect(JSON.stringify(call.where)).toContain(
        JSON.stringify({ createdBy: { departmentId: 2 } }),
      );
    });

    it('tab "department" should be denied to regular employees', async () => {
      const res = await service.findAll(
        { id: 5, departmentId: 2, roles: ['employee'] },
        { tab: 'department' },
      );
      expect(res).toEqual([]);
      expect(prisma.task.findMany).not.toHaveBeenCalled();
    });

    it('tab "department" should return empty array if user has no department', async () => {
      const user = { id: 5, departmentId: null, roles: ['employee'] };
      const res = await service.findAll(user, { tab: 'department' });
      expect(res).toEqual([]);
      expect(prisma.task.findMany).not.toHaveBeenCalled();
    });

    it('should compute runtime isOverdue correctly', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);

      prisma.task.findMany.mockResolvedValue([
        {
          id: 1,
          status: 'Đang làm',
          dueDate: yesterday,
          subTasks: [],
        },
        {
          id: 2,
          status: 'Hoàn thành',
          dueDate: yesterday, // Completed even if dueDate passed -> not overdue
          subTasks: [],
        },
        {
          id: 3,
          status: 'Đang làm',
          dueDate: tomorrow, // Future dueDate -> not overdue
          subTasks: [],
        },
      ]);

      const tasks = await service.findAll(
        { id: 1, roles: ['ceo'], departmentId: 1 },
        { tab: 'all' },
      );

      expect(tasks[0].isOverdue).toBe(true);
      expect(tasks[1].isOverdue).toBe(false);
      expect(tasks[2].isOverdue).toBe(false);
    });
  });

  describe('addComment', () => {
    it('should create comment and send notifications to mentioned users with unique dedupeKey', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 1, code: 'CV-2026-001' });
      prisma.comment.create.mockResolvedValue({
        id: 77,
        entityType: 'task',
        entityId: 1,
        userId: 1,
        content: 'Chào @Bình',
        mentions: [2, 3],
      });

      const user = { id: 1, name: 'Nguyễn Văn A' };
      await service.addComment(user, 1, {
        content: 'Chào @Bình',
        mentions: [2, 3],
      });

      expect(prisma.comment.create).toHaveBeenCalled();
      expect(notificationsService.dispatchNotification).toHaveBeenCalledTimes(
        2,
      );
      expect(notificationsService.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 2,
          eventType: 'task_comment_mention',
          dedupeKey: expect.stringContaining('task_mention_77_2_'),
        }),
      );
    });
  });
});
