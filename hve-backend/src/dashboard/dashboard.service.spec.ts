import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardService } from './dashboard.service.js';

describe('DashboardService role scopes', () => {
  let service: DashboardService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      document: { findMany: vi.fn(), groupBy: vi.fn() },
      task: { findMany: vi.fn(), groupBy: vi.fn() },
      department: { findMany: vi.fn() },
      project: { findMany: vi.fn() },
    };
    service = new DashboardService(prismaMock);
  });

  it('gives CEO company-wide metrics and project statistics', async () => {
    prismaMock.document.findMany
      .mockResolvedValueOnce([
        { id: 1, type: 'proposal', status: 'Chờ duyệt', dataJson: {} },
        { id: 2, type: 'proposal', status: 'Đã duyệt', dataJson: {} },
      ])
      .mockResolvedValueOnce([{ id: 1, status: 'Chờ duyệt' }])
      .mockResolvedValueOnce([]);
    prismaMock.task.findMany.mockResolvedValue([
      { id: 10, status: 'Đang làm', dueDate: new Date(Date.now() - 4 * 86400000) },
    ]);
    prismaMock.project.findMany.mockResolvedValue([
      { id: 1, name: 'Hồ bơi', code: 'HB' },
    ]);
    prismaMock.task.findMany.mockResolvedValue([
      {
        id: 10,
        projectId: 1,
        status: 'Đang làm',
        dueDate: new Date(Date.now() - 4 * 86400000),
      },
      { id: 11, projectId: 1, status: 'Hoàn thành', dueDate: null },
    ]);

    const result = await service.getDashboardData({ id: 1, roles: [{ name: 'ceo' }] });

    expect(result.scope.level).toBe('company');
    expect(result.capabilities.canViewCompany).toBe(true);
    expect(result.metrics.documents.total).toBe(2);
    expect(result.metrics.tasks.overdue).toBe(1);
    expect(result.projectStats[0]).toMatchObject({
      code: 'HB',
      totalTasks: 2,
      completionRate: 50,
    });
  });

  it('scopes a department head to the department', async () => {
    prismaMock.document.findMany
      .mockResolvedValueOnce([{ id: 2, type: 'proposal', status: 'Chờ duyệt', dataJson: {} }])
      .mockResolvedValueOnce([{ id: 2, status: 'Chờ duyệt' }])
      .mockResolvedValueOnce([]);
    prismaMock.task.findMany.mockResolvedValue([
      { id: 11, status: 'Đang làm', dueDate: null },
      { id: 12, status: 'Hoàn thành', dueDate: null },
    ]);

    const result = await service.getDashboardData({
      id: 2,
      roles: [{ name: 'department_head' }],
      departmentId: 7,
      department: { id: 7, name: 'Vận hành' },
    });

    expect(result.scope).toMatchObject({ level: 'department', departmentId: 7 });
    expect(result.scope.label).toBe('Huy Võ Education');
    expect(result.metrics.tasks.total).toBe(2);
    expect(result.actionRequired.pendingApprovalsCount).toBe(1);
    expect(prismaMock.project.findMany).not.toHaveBeenCalled();
  });

  it('merges accountant and legal capabilities without duplicate dashboards', async () => {
    prismaMock.document.findMany
      .mockResolvedValueOnce([
        { id: 1, type: 'payment_request', status: 'Đã duyệt', dataJson: { amount: 5000000 } },
        {
          id: 2,
          type: 'contract',
          status: 'Đã duyệt',
          dataJson: { endDate: new Date(Date.now() + 10 * 86400000).toISOString() },
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prismaMock.task.findMany.mockResolvedValue([]);

    const result = await service.getDashboardData({
      id: 3,
      roles: [{ name: 'employee' }, { name: 'accountant' }, { name: 'legal' }],
    });

    expect(result.roles).toEqual(['accountant', 'employee', 'legal']);
    expect(result.capabilities.canViewFinancials).toBe(true);
    expect(result.capabilities.canViewLegal).toBe(true);
    expect(result.metrics.financials.totalApprovedAmount).toBe(5000000);
    expect(result.metrics.legal.expiringSoon).toBe(1);
  });

  it('shows an employee only personal documents and assigned work', async () => {
    prismaMock.document.findMany
      .mockResolvedValueOnce([
        { id: 1, type: 'proposal', status: 'Nháp', dataJson: {} },
        { id: 2, type: 'proposal', status: 'Đã duyệt', dataJson: {} },
      ])
      .mockResolvedValueOnce([
        { id: 1, type: 'proposal', status: 'Nháp', dataJson: {} },
      ]);
    prismaMock.task.findMany.mockResolvedValue([
      { id: 5, status: 'Đang làm', dueDate: new Date(Date.now() - 3600000) },
    ]);

    const result = await service.getDashboardData({ id: 10, roles: [{ name: 'employee' }] });

    expect(result.scope.level).toBe('personal');
    expect(result.metrics.documents.total).toBe(2);
    expect(result.metrics.tasks.total).toBe(1);
    expect(result.actionRequired.returnedDocumentsCount).toBe(1);
    expect(result.projectStats).toBeUndefined();
  });

  it('uses cache per user, department and complete role set', async () => {
    prismaMock.document.findMany.mockResolvedValue([]);
    prismaMock.task.findMany.mockResolvedValue([]);
    prismaMock.project.findMany.mockResolvedValue([]);
    const user = { id: 1, roles: [{ name: 'ceo' }] };

    await service.getDashboardData(user);
    const callsAfterFirstRequest = prismaMock.document.findMany.mock.calls.length;
    await service.getDashboardData(user);
    expect(prismaMock.document.findMany).toHaveBeenCalledTimes(callsAfterFirstRequest);

    service.clearCache(user.id);
    await service.getDashboardData(user);
    expect(prismaMock.document.findMany).toHaveBeenCalledTimes(callsAfterFirstRequest * 2);
  });

  it('computes project health with grouped database queries and caches it', async () => {
    prismaMock.project.findMany.mockResolvedValue([
      { id: 1, code: 'A', name: 'Dự án A' },
      { id: 2, code: 'B', name: 'Dự án B' },
    ]);
    prismaMock.task.groupBy
      .mockResolvedValueOnce([
        { projectId: 1, _count: { _all: 8 } },
        { projectId: 2, _count: { _all: 2 } },
      ])
      .mockResolvedValueOnce([{ projectId: 1, _count: { _all: 3 } }]);
    prismaMock.document.groupBy
      .mockResolvedValueOnce([{ projectId: 1, _count: { _all: 2 } }])
      .mockResolvedValueOnce([{ projectId: 1, _count: { _all: 1 } }]);

    const result = await service.getProjectHealth();
    expect(result[0]).toMatchObject({
      id: 1,
      total: 10,
      overdue: 4,
      percent: 40,
      level: 'tre_tien_do',
    });
    expect(result[1]).toMatchObject({
      id: 2,
      total: 2,
      overdue: 0,
      level: 'binh_thuong',
    });

    await service.getProjectHealth();
    expect(prismaMock.project.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.task.groupBy).toHaveBeenCalledTimes(2);
    expect(prismaMock.document.groupBy).toHaveBeenCalledTimes(2);
  });
});
