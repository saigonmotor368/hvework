import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportsService } from './reports.service.js';

describe('ReportsService', () => {
  let service: ReportsService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      document: {
        findMany: vi.fn(),
      },
      task: {
        findMany: vi.fn(),
      },
      auditLog: {
        findMany: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
      },
    };

    service = new ReportsService(prismaMock);
  });

  describe('getSummary', () => {
    it('should aggregate documents, tasks, and contracts with applied filters', async () => {
      const mockDocs = [
        {
          id: 1,
          code: 'DNTT-001',
          title: 'Chi tiền',
          type: 'payment_request',
          status: 'Đã duyệt',
          createdAt: new Date(),
          createdBy: { name: 'Nguyễn Văn A', department: { name: 'Kế toán' } },
          steps: [{ stepOrder: 1, actedAt: new Date() }],
        },
      ];
      const mockTasks = [
        {
          id: 1,
          code: 'CV-001',
          title: 'Lập báo cáo',
          priority: 'normal',
          status: 'Hoàn thành',
          progressPercent: 100,
          assignee: { name: 'Trần Thị B', department: { name: 'IT' } },
          dueDate: new Date(Date.now() + 86400000),
          createdAt: new Date(),
        },
      ];

      prismaMock.document.findMany.mockResolvedValue(mockDocs);
      prismaMock.task.findMany.mockResolvedValue(mockTasks);

      const user = { id: 1, roles: [{ name: 'ceo' }] };
      const result = await service.getSummary(user, { departmentId: 1, userId: 2 });

      expect(result.documents.total).toBe(1);
      expect(result.documents.approvalRate).toBe(100);
      expect(result.tasks.total).toBe(1);
      expect(result.tasks.completionRate).toBe(100);
    });
  });

  describe('getAuditLogs security scope', () => {
    it('should throw ForbiddenException if user is employee', async () => {
      const user = { id: 10, roles: [{ name: 'employee' }] };
      await expect(service.getAuditLogs(user, {})).rejects.toThrow(ForbiddenException);
    });

    it('should allow CEO or it_admin to access audit logs', async () => {
      const user = { id: 1, roles: [{ name: 'ceo' }] };
      prismaMock.auditLog.findMany.mockResolvedValue([
        { id: 1, entityType: 'Document', entityId: 1, action: 'submit_approval', actorId: 2, createdAt: new Date() },
      ]);
      prismaMock.user.findMany.mockResolvedValue([{ id: 2, name: 'Nguyễn Văn A' }]);

      const result = await service.getAuditLogs(user, {});
      expect(result.length).toBe(1);
      expect(result[0].actor.name).toBe('Nguyễn Văn A');
    });
  });

  describe('exportCsv UTF-8 BOM and security', () => {
    it('should prepend UTF-8 BOM (\\uFEFF) to prevent Vietnamese mojibake in Excel', async () => {
      prismaMock.document.findMany.mockResolvedValue([
        {
          id: 1,
          code: 'DNTT-001',
          title: 'Thanh toán tiền điện thoại',
          type: 'payment_request',
          status: 'Đã duyệt',
          createdAt: new Date(),
          createdBy: { name: 'Trần Văn C', department: { name: 'Hành chính' } },
          steps: [],
        },
      ]);
      prismaMock.task.findMany.mockResolvedValue([]);

      const user = { id: 1, roles: [{ name: 'ceo' }] };
      const csv = await service.exportCsv(user, 'documents', {});

      // Verify BOM character
      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('Mã hồ sơ,Tiêu đề,Loại hồ sơ');
      expect(csv).toContain('Thanh toán tiền điện thoại');
      expect(csv).toContain('Đề nghị thanh toán');
    });

    it('should block non-admin from exporting audit_logs', async () => {
      const user = { id: 5, roles: [{ name: 'employee' }] };
      await expect(service.exportCsv(user, 'audit_logs', {})).rejects.toThrow(ForbiddenException);
    });
  });
});
