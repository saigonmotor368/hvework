import { Test, TestingModule } from '@nestjs/testing';
import {
  TasksService,
  addMonthsSafe,
  calculateNextDueDate,
} from './tasks.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('TasksService', () => {
  let service: TasksService;
  let prisma: any;
  let auditService: any;

  beforeEach(async () => {
    prisma = {
      task: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      attachment: {
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
        findMany: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb(prisma)),
    };

    auditService = {
      logEvent: vi.fn().mockResolvedValue({ id: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
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

      const user = { id: 1, name: 'Nguyễn Văn A' };
      const dto: any = {
        title: 'Làm báo cáo',
        assigneeId: 2,
        priority: 'high',
      };

      const result = await service.createTask(user, dto);
      expect(result.id).toBe(1);
      expect(prisma.task.create).toHaveBeenCalled();
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 2,
            eventType: 'task_assigned',
          }),
        }),
      );
      expect(auditService.logEvent).toHaveBeenCalled();
    });

    it('should reject creating subtask if parent task is already a subtask (max 2 levels)', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 10,
        parentTaskId: 5, // Already a subtask
      });

      await expect(
        service.createTask(
          { id: 1, name: 'User 1' },
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
          { id: 1, name: 'User 1' },
          { title: 'Subtask with recurrence', parentTaskId: 5, recurrenceRule: 'daily' },
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
          { id: 1, name: 'User 1' },
          { title: 'Subtask of recurring', parentTaskId: 5 },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateTask & Permissions', () => {
    it('creator should be allowed to change assignee and dueDate, and audit log is recorded', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 1,
        createdById: 1,
        assigneeId: 2,
        dueDate: new Date('2026-09-20'),
        createdBy: { departmentId: 10 },
      });
      prisma.task.update.mockResolvedValue({ id: 1, assigneeId: 3 });

      const user = { id: 1, roles: ['employee'], departmentId: 10 };
      await service.updateTask(user, 1, { assigneeId: 3 });

      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'reassign_or_reschedule',
        }),
      );
      expect(prisma.task.update).toHaveBeenCalled();
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
  });

  describe('updateProgress & Progress Calculation', () => {
    it('should disallow direct progress update on parent task that has subtasks', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 1,
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
      });
      prisma.task.update.mockResolvedValue({ id: 2, progressPercent: 100, status: 'Chờ duyệt' });

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
        status: 'Đang làm',
      });
      prisma.task.update.mockResolvedValue({ id: 2, progressPercent: 100, status: 'Chờ duyệt' });

      await service.updateProgress({ id: 5 }, 2, { progressPercent: 100 });

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 10,
            eventType: 'task_pending_approval',
          }),
        }),
      );
    });
  });

  describe('confirmCompletion (Double-submit prevention & Recurrence)', () => {
    it('should reject confirmCompletion if status is NOT "Chờ duyệt" (prevents double submit)', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 1,
        status: 'Hoàn thành', // Already completed
        createdById: 10,
      });

      await expect(
        service.confirmCompletion({ id: 10 }, 1),
      ).rejects.toThrow(BadRequestException);
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

      const result = await service.confirmCompletion({ id: 10, roles: ['employee'] }, 1);
      expect(result.task.status).toBe('Hoàn thành');
      expect(result.nextTask).toBeDefined();
      expect(prisma.task.create).toHaveBeenCalled();
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 20,
            eventType: 'task_recurring_created',
          }),
        }),
      );
    });
  });

  describe('findAll & Department Filtering', () => {
    it('tab "department" should filter by user department on both assignee and creator', async () => {
      prisma.task.findMany.mockResolvedValue([]);

      const user = { id: 5, departmentId: 2, roles: ['employee'] };
      await service.findAll(user, { tab: 'department' });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { assignee: { departmentId: 2 } },
              { createdBy: { departmentId: 2 } },
            ],
          }),
        }),
      );
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
      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 2,
            eventType: 'task_comment_mention',
            dedupeKey: expect.stringContaining('task_mention_77_2_'),
          }),
        }),
      );
    });
  });
});
