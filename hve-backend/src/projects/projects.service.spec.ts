import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProjectsService } from './projects.service.js';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: any;
  let notificationsService: any;

  beforeEach(async () => {
    prisma = {
      project: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      user: { count: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      comment: { findMany: vi.fn(), create: vi.fn() },
    };
    notificationsService = { dispatchNotification: vi.fn() };
    const module = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { logEvent: vi.fn() } },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();
    service = module.get(ProjectsService);
  });

  it('returns only active projects related to a regular employee', async () => {
    prisma.project.findMany.mockResolvedValue([]);
    await service.findVisible({ id: 22, roles: ['employee'] });
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          OR: [
            { leadUserId: 22 },
            { members: { some: { userId: 22 } } },
          ],
        },
      }),
    );
  });

  it('lets a project head browse the active project catalog without member details', async () => {
    prisma.project.findMany.mockResolvedValue([
      {
        id: 1,
        code: 'KNS',
        name: 'Kỹ Năng Sống',
        location: 'NVH',
        leadUserId: 9,
        isActive: true,
        members: [{ userId: 99 }],
        lead: { id: 9, email: 'lead@example.com' },
      },
    ]);
    const result = await service.findVisible({ id: 9, roles: ['department_head'] });
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
    expect(result[0]).not.toHaveProperty('members');
    expect(result[0]).not.toHaveProperty('lead');
  });

  describe('Project message board (giao lưu thành viên dự án)', () => {
    it('lets a project member post and read board messages of their own project', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 1, name: 'Kỹ Năng Sống' });
      prisma.comment.create.mockResolvedValue({
        id: 1,
        entityType: 'project_board',
        entityId: 1,
        userId: 99,
        content: 'Chào cả team!',
        mentions: [],
        createdAt: new Date(),
      });

      const member = {
        id: 99,
        name: 'Nhân viên A',
        roles: ['employee'],
        projectMemberships: [{ projectId: 1, project: { id: 1, isActive: true } }],
      };
      const result = await service.postBoardMessage(member, 1, { content: 'Chào cả team!' });
      expect(result.content).toBe('Chào cả team!');
      expect(prisma.comment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ entityType: 'project_board', entityId: 1, userId: 99 }),
        }),
      );
    });

    it('blocks a user with no membership in the project from reading/posting its board', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 2, name: 'CCA' });
      const outsider = { id: 50, roles: ['employee'], projectMemberships: [] };

      await expect(service.getBoardMessages(outsider, 2)).rejects.toThrow(ForbiddenException);
      await expect(
        service.postBoardMessage(outsider, 2, { content: 'lén xem' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lets CEO and BGĐ read/post on any project board without membership', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 3, name: 'TOUR du lịch' });
      prisma.comment.findMany.mockResolvedValue([]);
      prisma.comment.create.mockResolvedValue({
        id: 2,
        entityType: 'project_board',
        entityId: 3,
        userId: 1,
        content: 'Ban Giám Đốc thông báo',
        mentions: [],
        createdAt: new Date(),
      });

      const bgdUser = { id: 1, name: 'BGĐ Nguyễn', roles: ['bgd'] };
      await expect(service.getBoardMessages(bgdUser, 3)).resolves.toEqual([]);
      const posted = await service.postBoardMessage(bgdUser, 3, { content: 'Ban Giám Đốc thông báo' });
      expect(posted.content).toBe('Ban Giám Đốc thông báo');
    });

    it('notifies mentioned users when posting a board message', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 1, name: 'Kỹ Năng Sống' });
      prisma.comment.create.mockResolvedValue({
        id: 3,
        entityType: 'project_board',
        entityId: 1,
        userId: 99,
        content: '@An kiểm tra giúp',
        mentions: [42],
        createdAt: new Date(),
      });

      const member = {
        id: 99,
        name: 'Nhân viên A',
        roles: ['employee'],
        projectMemberships: [{ projectId: 1, project: { id: 1, isActive: true } }],
      };
      await service.postBoardMessage(member, 1, { content: '@An kiểm tra giúp', mentions: [42] });
      expect(notificationsService.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 42, eventType: 'project_board_mention' }),
      );
    });
  });
});
