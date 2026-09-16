import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';
import { ReportsService } from '../reports/reports.service.js';
import { DocumentsService } from '../documents/documents.service.js';

describe('Negative RBAC & Security Hardening Tests (Phase 5)', () => {
  let reflector: Reflector;
  let rolesGuard: RolesGuard;
  let prismaMock: any;
  let reportsService: ReportsService;
  let documentsService: DocumentsService;

  beforeEach(() => {
    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);

    prismaMock = {
      document: {
        findUnique: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
      documentApprovalStep: {
        findFirst: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
      task: {
        findMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
      },
    };

    reportsService = new ReportsService(prismaMock);
    documentsService = new DocumentsService(
      prismaMock,
      { logEvent: vi.fn() } as any,
      { dispatchNotification: vi.fn() } as any,
      {
        verifyApprovalPin: vi.fn().mockResolvedValue(undefined),
        isApprovalPinEnabled: vi.fn().mockResolvedValue(true),
      } as any,
    );
  });

  const createMockExecutionContext = (user: any, requiredRoles: string[]): ExecutionContext => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  describe('1. Admin & Workflow API Access Control (Negative Tests)', () => {
    it('should reject employee from accessing admin endpoints (throws ForbiddenException)', () => {
      const employeeUser = { id: 5, roles: [{ name: 'employee' }] };
      const context = createMockExecutionContext(employeeUser, ['it_admin']);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should reject department head from modifying workflow templates (throws ForbiddenException)', () => {
      const deptHeadUser = { id: 2, roles: [{ name: 'department_head' }] };
      const context = createMockExecutionContext(deptHeadUser, ['it_admin']);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe('2. Audit Log Protection (Negative Tests)', () => {
    it('should throw ForbiddenException when regular employee accesses audit logs', async () => {
      const employee = { id: 10, roles: [{ name: 'employee' }] };
      await expect(
        reportsService.getAuditLogs(employee, {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when accountant attempts to export audit logs', async () => {
      const accountant = { id: 11, roles: [{ name: 'accountant' }] };
      await expect(
        reportsService.exportCsv(accountant, 'audit_logs', {}),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('3. Financial & Contract Data Protection (Negative Tests)', () => {
    it('should throw ForbiddenException when regular employee attempts to export contracts CSV', async () => {
      const employee = { id: 12, roles: [{ name: 'employee' }] };
      await expect(
        reportsService.exportCsv(employee, 'contracts', {}),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('4. Cross-Department Approval Prevention (Negative Tests)', () => {
    it('should reject IT department head from approving document of Finance department', async () => {
      const itDeptHead = {
        id: 20,
        departmentId: 1, // IT Dept
        roles: [{ name: 'department_head' }],
      };

      prismaMock.document.findUnique.mockResolvedValue({
        id: 100,
        status: 'Chờ duyệt',
        version: 1,
        createdById: 99,
        createdBy: { id: 99, departmentId: 2 }, // Finance Dept!
        steps: [
          {
            id: 1,
            stepOrder: 1,
            roleRequired: 'department_head',
            status: 'pending',
          },
        ],
      });

      await expect(
        documentsService.approveStep(100, 1, itDeptHead, { comment: 'Duyệt thử' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('5. Anti-Self-Approval Enforcement (Negative Tests)', () => {
    it('should reject creator from self-approving their own document even with approval role', async () => {
      const creatorWithHeadRole = {
        id: 50,
        departmentId: 1,
        roles: [{ name: 'department_head' }],
      };

      prismaMock.document.findUnique.mockResolvedValue({
        id: 105,
        status: 'Chờ duyệt',
        version: 1,
        createdById: 50, // Creator is user #50!
        createdBy: { id: 50, departmentId: 1 },
        steps: [
          {
            id: 1,
            stepOrder: 1,
            roleRequired: 'department_head',
            status: 'pending',
          },
        ],
      });

      await expect(
        documentsService.approveStep(105, 1, creatorWithHeadRole, { comment: 'Tự duyệt' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
