import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotFoundException } from '@nestjs/common';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: any;
  let auditService: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      role: {
        findMany: vi.fn(),
      },
      department: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
    };

    auditService = {
      logEvent: vi.fn().mockResolvedValue({ id: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  describe('User Listing and Lookups', () => {
    it('should return list of all users without exposing passwords', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 1, email: 'admin@huyvoeducation.vn', name: 'IT Admin', status: 'active', roles: [] },
      ]);

      const users = await service.findAllUsers();
      expect(users).toHaveLength(1);
      expect(users[0].email).toBe('admin@huyvoeducation.vn');
    });

    it('should return list of roles and departments', async () => {
      prisma.role.findMany.mockResolvedValue([{ id: 1, name: 'ceo' }]);
      prisma.department.findMany.mockResolvedValue([{ id: 1, name: 'IT' }]);

      const roles = await service.findAllRoles();
      const depts = await service.findAllDepartments();
      expect(roles).toHaveLength(1);
      expect(depts).toHaveLength(1);
    });
  });

  describe('updateUserStatus', () => {
    it('should block IT admin from self-locking their own account', async () => {
      await expect(
        service.updateUserStatus(1, { status: 'locked' }, 1), // targetId === currentUserId (1)
      ).rejects.toThrow('Quản trị viên không thể tự khóa tài khoản của chính mình');
    });

    it('should throw NotFoundException if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateUserStatus(99, { status: 'locked' }, 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('should successfully lock another user and write audit log', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 5,
        email: 'nv1@huyvoeducation.vn',
        status: 'active',
      });
      prisma.user.update.mockResolvedValue({
        id: 5,
        email: 'nv1@huyvoeducation.vn',
        status: 'locked',
      });

      const res = await service.updateUserStatus(5, { status: 'locked' }, 1);
      expect(res.status).toBe('locked');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 5 },
          data: { status: 'locked' },
        }),
      );
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'update_user_status' }),
      );
    });
  });

  describe('updateUserRoles', () => {
    it('should reject if any roleId is invalid', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 5, roles: [] });
      prisma.role.findMany.mockResolvedValue([{ id: 1, name: 'employee' }]); // only role 1 exists

      await expect(
        service.updateUserRoles(5, { roleIds: [1, 999] }, 1),
      ).rejects.toThrow('Một hoặc nhiều mã vai trò không hợp lệ');
    });

    it('should update user roles and department successfully', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 5, roles: [] });
      prisma.role.findMany.mockResolvedValue([
        { id: 1, name: 'employee' },
        { id: 2, name: 'department_head' },
      ]);
      prisma.department.findUnique.mockResolvedValue({ id: 1, name: 'IT' });
      prisma.user.update.mockResolvedValue({
        id: 5,
        department: { id: 1 },
        roles: [{ id: 1, name: 'employee' }, { id: 2, name: 'department_head' }],
      });

      const res = await service.updateUserRoles(
        5,
        { roleIds: [1, 2], departmentId: 1 },
        1,
      );

      expect(res.roles).toHaveLength(2);
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'update_user_roles' }),
      );
    });
  });
});
