import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectReportsService } from './project-reports.service.js';

const baseReport = {
  id: 7,
  code: 'BCDA-20260919-0000001',
  title: 'Báo cáo tuần',
  content: 'Đã hoàn thành kế hoạch',
  status: 'draft',
  periodStart: null,
  periodEnd: null,
  projectId: 3,
  authorId: 10,
  submittedAt: null,
  reviewedById: null,
  reviewedAt: null,
  reviewComment: null,
  revision: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  author: { id: 10, name: 'Nhân viên A', email: 'a@hve.vn' },
  project: { id: 3, code: 'KNS', name: 'Kỹ năng sống', leadUserId: 20 },
  viewers: [
    { userId: 30, user: { id: 30, name: 'Người xem', email: 'viewer@hve.vn' } },
  ],
  reviewedBy: null,
};

describe('ProjectReportsService', () => {
  let prisma: any;
  let audit: any;
  let notifications: any;
  let service: ProjectReportsService;

  beforeEach(() => {
    prisma = {
      projectReport: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      projectReportViewer: { deleteMany: vi.fn() },
      attachment: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      user: { count: vi.fn(), findMany: vi.fn() },
      project: { findUnique: vi.fn() },
      $transaction: vi.fn(async (operation: any) =>
        typeof operation === 'function'
          ? operation(prisma)
          : Promise.all(operation),
      ),
    };
    audit = { logEvent: vi.fn().mockResolvedValue(undefined) };
    notifications = {
      dispatchNotification: vi.fn().mockResolvedValue({ in_app: true }),
    };
    service = new ProjectReportsService(prisma, audit, notifications);
  });

  it('giữ bản nháp riêng tư và chỉ mở bản đã nộp cho người xem hoặc trưởng dự án', async () => {
    prisma.projectReport.findMany.mockResolvedValue([]);
    await service.findAll(
      { id: 10, roles: ['employee'], ledProjects: [], projectMemberships: [] },
      {},
    );
    expect(prisma.projectReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              OR: [
                { authorId: 10 },
                {
                  AND: [
                    { status: { not: 'draft' } },
                    {
                      OR: [
                        { viewers: { some: { userId: 10 } } },
                        { project: { leadUserId: 10 } },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      }),
    );
  });

  it('cho CEO xem báo cáo đã nộp và bản nháp của chính mình', async () => {
    prisma.projectReport.findMany.mockResolvedValue([]);
    await service.findAll({ id: 1, roles: ['ceo'] }, {});
    expect(prisma.projectReport.findMany.mock.calls[0][0].where).toEqual({
      AND: [{ OR: [{ authorId: 1 }, { status: { not: 'draft' } }] }],
    });
  });

  it('cho tác giả sửa báo cáo đang chờ duyệt và tăng phiên bản', async () => {
    const submitted = {
      ...baseReport,
      status: 'submitted',
    };
    prisma.projectReport.findUnique.mockResolvedValue(submitted);
    prisma.projectReport.update.mockResolvedValue({
      ...submitted,
      title: 'Sửa',
      content: 'Sửa nội dung',
      revision: 2,
    });

    const result = await service.update(
      { id: 10, roles: ['employee'], projectMemberships: [{ projectId: 3 }] },
      7,
      {
        title: 'Sửa',
        content: 'Sửa nội dung',
        projectId: 3,
      },
    );

    expect(prisma.projectReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7 },
        data: expect.objectContaining({ revision: { increment: 1 } }),
      }),
    );
    expect(result.permissions.canEdit).toBe(true);
    expect(result.permissions.canSubmit).toBe(false);
  });

  it('cho tác giả xóa báo cáo đang chờ duyệt nhưng khóa báo cáo đã duyệt', async () => {
    prisma.projectReport.findUnique.mockResolvedValue({
      ...baseReport,
      status: 'submitted',
    });
    await service.remove({ id: 10, roles: ['employee'] }, 7);
    expect(prisma.projectReport.delete).toHaveBeenCalledWith({
      where: { id: 7 },
    });

    prisma.projectReport.findUnique.mockResolvedValue({
      ...baseReport,
      status: 'approved',
    });
    await expect(
      service.remove({ id: 10, roles: ['employee'] }, 7),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('cho Quản trị IT xem toàn bộ và xóa cưỡng chế báo cáo bị treo', async () => {
    prisma.projectReport.findMany.mockResolvedValue([]);
    await service.findAll({ id: 99, roles: ['it_admin'] }, {});
    expect(prisma.projectReport.findMany.mock.calls[0][0].where).toEqual({
      AND: [{}],
    });

    prisma.projectReport.findUnique.mockResolvedValue({
      ...baseReport,
      status: 'approved',
    });
    await service.remove({ id: 99, roles: ['it_admin'] }, 7);
    expect(audit.logEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: 'admin_force_delete_report' }),
    );
  });

  it('bắt buộc ghi lý do khi yêu cầu làm lại', async () => {
    prisma.projectReport.findFirst.mockResolvedValue({
      ...baseReport,
      status: 'submitted',
    });
    await expect(
      service.review({ id: 30, name: 'Người xem', roles: ['employee'] }, 7, {
        action: 'reject',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.projectReport.update).not.toHaveBeenCalled();
  });

  it('duyệt báo cáo sẽ khóa phiên bản và thông báo cho tác giả', async () => {
    const submitted = { ...baseReport, status: 'submitted' };
    const approved = {
      ...submitted,
      status: 'approved',
      reviewedById: 30,
      reviewedBy: { id: 30, name: 'Người xem', email: 'viewer@hve.vn' },
    };
    prisma.projectReport.findFirst.mockResolvedValue(submitted);
    prisma.projectReport.update.mockResolvedValue(approved);

    const result = await service.review(
      { id: 30, name: 'Người xem', roles: ['employee'] },
      7,
      { action: 'approve', comment: 'Đạt' },
    );

    expect(prisma.projectReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7 },
        data: expect.objectContaining({ status: 'approved', reviewedById: 30 }),
      }),
    );
    expect(notifications.dispatchNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 10,
        eventType: 'project_report_approved',
      }),
      ['in_app'],
    );
    expect(result.permissions).toEqual({
      canEdit: false,
      canDelete: false,
      canSubmit: false,
      canReview: false,
    });
  });
});
