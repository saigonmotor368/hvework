import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AnnouncementsService } from './announcements.service.js';

describe('AnnouncementsService', () => {
  let service: AnnouncementsService;
  let prisma: any;
  let auditService: any;
  let notificationsService: any;

  beforeEach(async () => {
    prisma = {
      announcement: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      project: { count: vi.fn().mockResolvedValue(1) },
      user: { findMany: vi.fn().mockResolvedValue([]) },
    };
    auditService = { logEvent: vi.fn() };
    notificationsService = { dispatchNotification: vi.fn() };
    const module = await Test.createTestingModule({
      providers: [
        AnnouncementsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();
    service = module.get(AnnouncementsService);
  });

  it('only queries global announcements and direct project memberships', async () => {
    await service.findVisible({
      id: 7,
      roles: ['employee'],
      projectMemberships: [
        { projectId: 11, project: { id: 11, isActive: true } },
      ],
      delegatedFrom: [
        {
          id: 8,
          delegateUntil: new Date(Date.now() + 60_000),
          projectMemberships: [
            { projectId: 99, project: { id: 99, isActive: true } },
          ],
        },
      ],
    });

    const where = prisma.announcement.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('published');
    expect(where.AND[1].OR).toEqual([
      { projectId: null },
      { projectId: { in: [11] } },
    ]);
    expect(where.AND[1].OR[1].projectId.in).not.toContain(99);
  });

  it('filters scheduled and expired announcements at read time', async () => {
    await service.findVisible({ id: 1, roles: ['employee'] });
    const where = prisma.announcement.findMany.mock.calls[0][0].where;
    expect(where.publishedAt.lte).toBeInstanceOf(Date);
    expect(where.AND[0].OR[1].expiresAt.gt).toBeInstanceOf(Date);
  });

  it('does not return an announcement outside the user scope', async () => {
    prisma.announcement.findFirst.mockResolvedValue(null);
    await expect(
      service.findVisibleById({ id: 1, roles: ['employee'] }, 123),
    ).rejects.toThrow(NotFoundException);
  });

  it('requires a start time for meeting announcements', async () => {
    await expect(
      service.create(
        {
          title: 'Họp tuần',
          content: 'Nội dung họp',
          type: 'meeting',
        },
        1,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates an interoperable calendar file for a visible meeting', async () => {
    prisma.announcement.findFirst.mockResolvedValue({
      id: 5,
      title: 'Họp triển khai HVE Work',
      summary: 'Thống nhất kế hoạch',
      content: 'Mời mọi người tham dự.',
      type: 'meeting',
      status: 'published',
      meetingStartAt: new Date('2026-09-20T02:00:00.000Z'),
      meetingEndAt: new Date('2026-09-20T03:00:00.000Z'),
      location: 'Văn phòng HVE',
      meetingUrl: 'https://meet.example.com/hve',
    });

    const result = await service.buildCalendar({ id: 1 }, 5);
    expect(result).toContain('BEGIN:VCALENDAR');
    expect(result).toContain('DTSTART:20260920T020000Z');
    expect(result).toContain('SUMMARY:Họp triển khai HVE Work');
    expect(result).toContain('UID:announcement-5@huyvoeducation.vn');
  });

  it('invalidates list cache after an administrator publishes a draft', async () => {
    prisma.announcement.findMany
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);
    prisma.announcement.findUnique.mockResolvedValue({
      id: 2,
      title: 'Thông báo mới',
      content: 'Nội dung',
      type: 'news',
      priority: 'normal',
      status: 'draft',
      isPinned: false,
      projectId: null,
      publishedAt: null,
      expiresAt: null,
    });
    prisma.announcement.update.mockImplementation(({ data }: any) => ({
      id: 2,
      ...data,
    }));

    await service.findVisible({ id: 1 });
    await service.publish(2, 9);
    const refreshed = await service.findVisible({ id: 1 });

    expect(refreshed).toHaveLength(2);
    expect(prisma.announcement.findMany).toHaveBeenCalledTimes(2);
    expect(auditService.logEvent).toHaveBeenCalled();
  });

  it('dispatches in-app and Web Push notifications to the direct project audience', async () => {
    prisma.announcement.findMany.mockResolvedValue([{ id: 7 }]);
    prisma.announcement.findUnique.mockResolvedValue({
      id: 7,
      title: 'Lịch họp dự án HVE',
      summary: 'Họp triển khai tuần mới',
      content: 'Mời thành viên dự án tham dự.',
      type: 'meeting',
      priority: 'important',
      status: 'published',
      projectId: 12,
      publishedAt: new Date(Date.now() - 1_000),
      notifiedAt: null,
    });
    prisma.announcement.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findMany.mockResolvedValue([{ id: 4 }, { id: 8 }]);
    notificationsService.dispatchNotification.mockResolvedValue({
      in_app: true,
    });

    await service.dispatchScheduledAnnouncementNotifications();

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        status: 'active',
        OR: [
          { ledProjects: { some: { id: 12 } } },
          { projectMemberships: { some: { projectId: 12 } } },
        ],
      },
      select: { id: true },
    });
    expect(notificationsService.dispatchNotification).toHaveBeenCalledTimes(2);
    expect(notificationsService.dispatchNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 4,
        eventType: 'announcement_published',
        entityRef: 'announcement:7',
        link: '/announcements?id=7',
        dedupeKey: 'announcement_7_user4',
      }),
      ['in_app'],
    );
  });
});
