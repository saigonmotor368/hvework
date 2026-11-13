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
      taskView: {
        upsert: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([]),
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
      auditLog: {
        findFirst: vi.fn().mockResolvedValue(null),
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

  describe('getAssignableUsers', () => {
    it('lets an accountant assign active employees across the company', async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          id: 7,
          name: 'Nhân sự dự án',
          email: 'member@hve.vn',
          departmentId: 20,
        },
      ]);

      const result = await service.getAssignableUsers({
        id: 3,
        roles: ['accountant'],
        departmentId: null,
      });

      expect(result).toHaveLength(1);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'active' },
        }),
      );
    });

    it('keeps department heads limited to their managed scope', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      await service.getAssignableUsers({
        id: 4,
        roles: ['department_head'],
        departmentId: 10,
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ departmentId: 10 }),
        }),
      );
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

    it('notifies every collaborator assigned to a task list item', async () => {
      prisma.task.findFirst.mockResolvedValue(null);
      prisma.task.create.mockResolvedValue({
        id: 14,
        code: 'CV-2026-014',
        title: 'Rà soát hồ sơ pháp lý',
        assigneeId: 2,
        createdById: 1,
      });

      await service.createTask(
        { id: 1, name: 'CEO', roles: ['ceo'] },
        {
          title: 'Rà soát hồ sơ pháp lý',
          assigneeId: 2,
          collaboratorIds: [3, 4, 3],
        },
      );

      expect(notificationsService.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 3,
          eventType: 'task_collaborator_assigned',
        }),
      );
      expect(notificationsService.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 4,
          eventType: 'task_collaborator_assigned',
        }),
      );
      expect(notificationsService.dispatchNotification).toHaveBeenCalledTimes(
        3,
      );
    });

    it('should reject task creation by a regular employee', async () => {
      await expect(
        service.createTask(
          { id: 1, name: 'Nhân viên', roles: ['employee'] },
          { title: 'Không được phép giao' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows an accountant to create an inventory task', async () => {
      prisma.task.findFirst.mockResolvedValue(null);
      prisma.task.create.mockResolvedValue({
        id: 12,
        code: 'CV-2026-012',
        title: 'Kiểm kê tài sản',
        assigneeId: null,
        createdById: 3,
      });

      const result = await service.createTask(
        {
          id: 3,
          name: 'Kế toán',
          roles: ['accountant'],
          departmentId: 2,
        },
        { title: 'Kiểm kê tài sản' },
      );

      expect(result.id).toBe(12);
      expect(prisma.task.create).toHaveBeenCalled();
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'task',
          action: 'create_task',
          actorId: 3,
        }),
      );
    });

    it('allows an accountant to assign a task to another department', async () => {
      prisma.task.findFirst.mockResolvedValue(null);
      prisma.task.create.mockResolvedValue({
        id: 15,
        code: 'CV-2026-015',
        title: 'Kiểm kê tài sản dự án',
        assigneeId: 9,
        createdById: 3,
      });

      const result = await service.createTask(
        {
          id: 3,
          name: 'Kế toán',
          roles: ['accountant'],
          departmentId: null,
        },
        { title: 'Kiểm kê tài sản dự án', assigneeId: 9 },
      );

      expect(result.id).toBe(15);
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
      expect(notificationsService.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 9, eventType: 'task_assigned' }),
      );
    });

    it('allows a task manager to publish a company-visible task list', async () => {
      prisma.task.findFirst.mockResolvedValue(null);
      prisma.task.create.mockImplementation(async ({ data }: any) => ({
        id: 13,
        code: 'CV-2026-013',
        ...data,
      }));

      await service.createTask(
        { id: 3, name: 'Kế toán', roles: ['accountant'], departmentId: 2 },
        { title: 'Kiểm kê toàn công ty', isCompanyVisible: true },
      );

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ visibility: 'company' }),
        }),
      );
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
          OR: [{ assigneeId: 5 }, { collaboratorIds: { array_contains: [5] } }],
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

  describe('findById read receipts', () => {
    it('records the viewer and returns the people who opened the task', async () => {
      prisma.task.findFirst.mockResolvedValue({
        id: 21,
        code: 'CV-2026-021',
        status: 'Đang làm',
        dueDate: null,
        subTasks: [],
      });
      prisma.attachment.findMany.mockResolvedValue([]);
      prisma.comment.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.taskView.findMany.mockResolvedValue([
        {
          firstViewedAt: new Date('2026-09-24T08:00:00Z'),
          lastViewedAt: new Date('2026-09-24T08:05:00Z'),
          viewCount: 2,
          user: {
            id: 7,
            name: 'Người đã xem',
            email: 'viewer@hve.vn',
            avatarUrl: null,
          },
        },
      ]);

      const result = await service.findById(
        { id: 7, roles: ['employee'], departmentId: 2 },
        21,
      );

      expect(prisma.taskView.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { taskId_userId: { taskId: 21, userId: 7 } },
          update: expect.objectContaining({ viewCount: { increment: 1 } }),
        }),
      );
      expect(result.viewers).toHaveLength(1);
      expect(result.viewers[0].user.name).toBe('Người đã xem');
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

  describe('Vòng đời công việc: gia hạn / tạm ngừng / hủy / khôi phục', () => {
    const manager = { id: 1, name: 'Giao việc', roles: ['department_head'], departmentId: 10 };
    const baseTask = (overrides: any = {}) => ({
      id: 5,
      code: 'CV-2026-005',
      title: 'Làm hồ sơ',
      status: 'Đang làm',
      progressPercent: 40,
      startDate: new Date('2026-09-01'),
      dueDate: new Date('2030-01-10'),
      createdById: 1,
      assigneeId: 2,
      collaboratorIds: [3],
      parentTaskId: null,
      projectId: null,
      createdBy: { departmentId: 10 },
      subTasks: [],
      ...overrides,
    });

    it('tạm ngừng cần lý do, lưu trạng thái trước đó và thông báo cả nhóm', async () => {
      prisma.task.findUnique.mockResolvedValue(baseTask());
      prisma.task.update.mockResolvedValue({ id: 5, status: 'Tạm ngừng' });

      await expect(
        service.pauseTask(manager, 5, { reason: ' ' }),
      ).rejects.toThrow(BadRequestException);

      await service.pauseTask(manager, 5, { reason: 'Chờ khách hàng duyệt mặt bằng' });
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { status: 'Tạm ngừng' },
      });
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'pause_task',
          beforeJson: { status: 'Đang làm' },
        }),
      );
      expect(prisma.comment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          content: expect.stringContaining('Chờ khách hàng duyệt mặt bằng'),
        }),
      });
      const recipients = notificationsService.dispatchNotification.mock.calls.map(
        (call: any[]) => call[0].userId,
      );
      expect(recipients).toEqual([2, 3]);
    });

    it('chỉ người quản lý mới được tạm ngừng / hủy / gia hạn', async () => {
      prisma.task.findUnique.mockResolvedValue(baseTask());
      const outsider = { id: 99, name: 'NV', roles: ['employee'], departmentId: 20 };
      await expect(
        service.pauseTask(outsider, 5, { reason: 'Không có quyền' }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.cancelTask(outsider, 5, { reason: 'Không có quyền' }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.extendTask(outsider, 5, { dueDate: '2031-01-01', reason: 'Không có quyền' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('không tạm ngừng việc đã hoàn thành hoặc đã hủy', async () => {
      prisma.task.findUnique.mockResolvedValue(baseTask({ status: 'Hoàn thành' }));
      await expect(
        service.pauseTask(manager, 5, { reason: 'Đã xong rồi mà' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.cancelTask(manager, 5, { reason: 'Đã xong rồi mà' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('hủy kéo theo việc con chưa xong và tính lại tiến độ việc cha', async () => {
      prisma.task.findUnique
        .mockResolvedValueOnce(
          baseTask({
            id: 7,
            parentTaskId: 5,
            subTasks: [],
          }),
        )
        .mockResolvedValue({ status: 'Đang làm' });
      prisma.task.update.mockResolvedValue({ id: 7 });
      prisma.task.findMany.mockResolvedValue([
        { progressPercent: 100, status: 'Hoàn thành' },
      ]);

      await service.cancelTask(manager, 7, { reason: 'Không còn nhu cầu' });

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { status: 'Đã hủy' },
      });
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { parentTaskId: 5, status: { not: 'Đã hủy' } },
        }),
      );
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { progressPercent: 100, status: 'Chờ duyệt' },
      });
    });

    it('khôi phục đưa việc về đúng trạng thái trước khi tạm ngừng', async () => {
      prisma.task.findUnique.mockResolvedValue(baseTask({ status: 'Tạm ngừng' }));
      prisma.auditLog.findFirst.mockResolvedValue({
        beforeJson: { status: 'Chờ duyệt' },
      });
      prisma.task.update.mockResolvedValue({ id: 5 });

      await service.resumeTask(manager, 5, {});

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { status: 'Chờ duyệt' },
      });
    });

    it('khôi phục dự phòng theo tiến độ khi không có nhật ký', async () => {
      prisma.task.findUnique.mockResolvedValue(
        baseTask({ status: 'Đã hủy', progressPercent: 0, startDate: null }),
      );
      prisma.task.update.mockResolvedValue({ id: 5 });

      await service.resumeTask(manager, 5, {});

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { status: 'Chưa làm' },
      });
    });

    it('gia hạn chỉ chấp nhận hạn mới sau hạn cũ và phải có lý do', async () => {
      prisma.task.findUnique.mockResolvedValue(baseTask());
      prisma.task.update.mockResolvedValue({ id: 5 });

      await expect(
        service.extendTask(manager, 5, { dueDate: '2029-12-01', reason: 'Dời lịch khách hàng' }),
      ).rejects.toThrow('Hạn mới phải sau hạn hiện tại');
      await expect(
        service.extendTask(manager, 5, { dueDate: '2030-02-01', reason: '' }),
      ).rejects.toThrow(BadRequestException);

      await service.extendTask(manager, 5, {
        dueDate: '2030-02-01',
        reason: 'Dời lịch khách hàng',
      });
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { dueDate: new Date('2030-02-01') },
      });
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'extend_task' }),
      );
    });

    it('người thực hiện không cập nhật tiến độ / nhận việc khi tạm ngừng hoặc đã hủy', async () => {
      const assignee = { id: 2, roles: ['employee'], departmentId: 10 };
      prisma.task.findUnique.mockResolvedValue(baseTask({ status: 'Tạm ngừng', subTasks: [] }));
      await expect(
        service.updateProgress(assignee, 5, { progressPercent: 60 } as any),
      ).rejects.toThrow('tạm ngừng');
      prisma.task.findUnique.mockResolvedValue(baseTask({ status: 'Đã hủy', subTasks: [] }));
      await expect(
        service.acceptTask(assignee, 5),
      ).rejects.toThrow('đã hủy');
    });

    it('chỉnh sửa nội dung công việc chỉ dành cho người quản lý, việc đã hủy bị khóa', async () => {
      prisma.task.findUnique.mockResolvedValue(baseTask());
      await expect(
        service.updateTask(
          { id: 2, roles: ['employee'], departmentId: 10 },
          5,
          { title: 'Đổi tiêu đề' },
        ),
      ).rejects.toThrow(ForbiddenException);

      prisma.task.findUnique.mockResolvedValue(baseTask({ status: 'Đã hủy' }));
      await expect(
        service.updateTask(manager, 5, { title: 'Đổi tiêu đề' }),
      ).rejects.toThrow('đã hủy');
    });

    it('sửa công việc ghi nhật ký các trường đã đổi', async () => {
      prisma.task.findUnique.mockResolvedValue(baseTask());
      prisma.task.update.mockResolvedValue({ id: 5, code: 'CV-2026-005', title: 'Mới', assigneeId: 2 });

      await service.updateTask(manager, 5, { title: '  Mới ', priority: 'high' });

      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: 'Mới', priority: 'high' }),
        }),
      );
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update_task',
          afterJson: { changedFields: ['title', 'priority'] },
        }),
      );
    });
  });
});
