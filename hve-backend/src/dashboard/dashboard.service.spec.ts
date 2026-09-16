import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      document: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      task: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      department: {
        findMany: vi.fn(),
      },
    };

    service = new DashboardService(prismaMock);
  });

  it('should return CEO dashboard with action items and metrics', async () => {
    prismaMock.document.findMany.mockResolvedValueOnce([
      { id: 1, code: 'DNTT-001', title: 'Hồ sơ 1', type: 'payment_request', createdAt: new Date() },
    ]);
    prismaMock.task.findMany.mockResolvedValueOnce([
      { id: 10, code: 'CV-001', title: 'Việc quá hạn 3 ngày', dueDate: new Date() },
    ]);
    prismaMock.document.count.mockResolvedValue(10);
    prismaMock.task.count.mockResolvedValue(20);
    prismaMock.document.findMany.mockResolvedValueOnce([]); // contracts
    prismaMock.department.findMany.mockResolvedValueOnce([
      { id: 1, name: 'Công nghệ thông tin', code: 'IT', users: [{ assignedTasks: [{ status: 'Hoàn thành' }] }] },
    ]);

    const user = { id: 1, roles: [{ name: 'ceo' }] };
    const result = await service.getDashboardData(user);

    expect(result.role).toBe('ceo');
    expect(result.actionRequired.pendingApprovalsCount).toBe(1);
    expect(result.actionRequired.escalatedTasksCount).toBe(1);
    expect(result.metrics.documents.total).toBe(10);
    expect(result.departmentStats[0].completionRate).toBe(100);
  });

  it('should return Department Head dashboard scoped to department', async () => {
    prismaMock.document.findMany.mockResolvedValueOnce([
      { id: 2, code: 'DX-001', title: 'Đề xuất 1', type: 'proposal' },
    ]);
    prismaMock.task.findMany
      .mockResolvedValueOnce([{ id: 11, code: 'CV-002', title: 'Việc quá hạn phòng IT' }])
      .mockResolvedValueOnce([{ status: 'Hoàn thành' }, { status: 'Đang làm' }]);

    const user = { id: 2, roles: [{ name: 'department_head' }], departmentId: 1 };
    const result = await service.getDashboardData(user);

    expect(result.role).toBe('department_head');
    expect(result.actionRequired.pendingApprovalsCount).toBe(1);
    expect(result.actionRequired.overdueTasksCount).toBe(1);
    expect(result.metrics.departmentTasks.total).toBe(2);
    expect(result.metrics.departmentTasks.completed).toBe(1);
  });

  it('should use in-memory cache on subsequent requests within 60s', async () => {
    prismaMock.document.findMany.mockResolvedValue([
      { id: 1, code: 'DNTT-001', title: 'Hồ sơ 1', type: 'payment_request' },
    ]);
    prismaMock.task.findMany.mockResolvedValue([]);
    prismaMock.document.count.mockResolvedValue(5);
    prismaMock.task.count.mockResolvedValue(5);
    prismaMock.department.findMany.mockResolvedValue([]);

    const user = { id: 1, roles: [{ name: 'ceo' }] };
    
    // First call: hits prisma
    await service.getDashboardData(user);
    expect(prismaMock.document.count).toHaveBeenCalledTimes(4);

    // Second call: should use cache, no new count calls
    await service.getDashboardData(user);
    expect(prismaMock.document.count).toHaveBeenCalledTimes(4);

    // Clear cache, third call should hit prisma again
    service.clearCache(user.id);
    await service.getDashboardData(user);
    expect(prismaMock.document.count).toHaveBeenCalledTimes(8);
  });
});
