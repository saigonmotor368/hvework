import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsService } from './documents.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import {
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';

import { NotificationsService } from '../notifications/notifications.service.js';
import { AuthService } from '../auth/auth.service.js';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prisma: any;
  let auditService: any;
  let notificationsService: any;
  let authService: any;

  beforeEach(async () => {
    prisma = {
      document: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      documentApprovalStep: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      workflowTemplate: {
        findUnique: vi.fn(),
      },
      attachment: {
        updateMany: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([{ id: 2 }]),
        findFirst: vi.fn(),
        count: vi.fn(),
      },
      project: {
        findMany: vi.fn(),
      },
      $transaction: vi.fn(async (cb: any) => cb(prisma)),
    };

    auditService = {
      logEvent: vi.fn().mockResolvedValue({ id: 1 }),
    };

    notificationsService = {
      dispatchNotification: vi
        .fn()
        .mockResolvedValue({ in_app: true, email: true }),
    };

    authService = {
      verifyApprovalPin: vi.fn().mockResolvedValue(undefined),
      isApprovalPinEnabled: vi.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  describe('generateDocumentCode', () => {
    it('should generate DNTT-YYYY-001 when no existing document exists', async () => {
      prisma.document.findFirst.mockResolvedValue(null);
      const year = new Date().getFullYear();
      const code = await service.generateDocumentCode('DNTT');
      expect(code).toBe(`DNTT-${year}-001`);
    });

    it('should increment sequence when existing document exists', async () => {
      const year = new Date().getFullYear();
      prisma.document.findFirst.mockResolvedValue({
        code: `DNTT-${year}-015`,
      });
      const code = await service.generateDocumentCode('DNTT');
      expect(code).toBe(`DNTT-${year}-016`);
    });
  });

  describe('createPaymentRequest', () => {
    it('should create draft payment request with version 1 and log audit event', async () => {
      prisma.document.findFirst.mockResolvedValue(null);
      prisma.document.create.mockResolvedValue({
        id: 1,
        code: 'DNTT-2026-001',
        title: 'Thanh toán nhà cung cấp',
        status: 'Nháp',
        version: 1,
        createdById: 10,
      });

      const result = await service.createPaymentRequest(
        { id: 10, roles: ['employee'] },
        {
          title: 'Thanh toán nhà cung cấp',
          amount: 5000000,
          receiver: 'Công ty ABC',
          bankName: 'Vietcombank',
          bankAccount: '1234567890',
          content: 'Thanh toán chi phí hosting',
          deadline: '2026-10-01',
        },
      );

      expect(result.id).toBe(1);
      expect(result.status).toBe('Nháp');
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create_document', entityId: 1 }),
      );
    });
  });

  describe('findById', () => {
    it('should include uploader identity for every attachment', async () => {
      prisma.document.findFirst.mockResolvedValue({
        id: 1,
        type: 'payment_request',
        title: 'Thanh toán nhà cung cấp',
        status: 'Chờ duyệt',
        createdById: 10,
        dataJson: {},
        steps: [
          {
            id: 501,
            stepOrder: 1,
            roleRequired: 'accountant',
            status: 'approved',
            actedById: 20,
          },
        ],
      });
      prisma.attachment.findMany.mockResolvedValue([
        {
          id: 100,
          entityId: 1,
          entityType: 'document',
          fileName: 'hoa-don.pdf',
          uploadedById: 20,
        },
      ]);
      prisma.user.findMany.mockResolvedValue([
        {
          id: 20,
          name: 'Kế toán HVE',
          email: 'ketoan@huyvoeducation.vn',
          roles: [{ name: 'accountant' }],
        },
      ]);

      const result = await service.findById(
        { id: 1, roles: ['ceo'] },
        1,
      );

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { id: { in: [20] } },
        select: {
          id: true,
          name: true,
          email: true,
          roles: { select: { name: true } },
        },
      });
      expect(result.attachments).toEqual([
        expect.objectContaining({
          id: 100,
          uploadedBy: expect.objectContaining({
            id: 20,
            name: 'Kế toán HVE',
            roles: [{ name: 'accountant' }],
          }),
        }),
      ]);
      expect(result.steps).toEqual([
        expect.objectContaining({
          id: 501,
          actedBy: expect.objectContaining({
            id: 20,
            name: 'Kế toán HVE',
          }),
        }),
      ]);
    });

    it('should return an empty attachment list without querying users', async () => {
      prisma.document.findFirst.mockResolvedValue({
        id: 2,
        type: 'proposal',
        title: 'Đề xuất nội bộ',
        status: 'Nháp',
        createdById: 10,
        dataJson: {},
      });
      prisma.attachment.findMany.mockResolvedValue([]);

      const result = await service.findById(
        { id: 10, roles: ['employee'] },
        2,
      );

      expect(result.attachments).toEqual([]);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe('updateDocument', () => {
    it('should let the creator revise returned draft content and replace attachments', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        code: 'DX-2026-001',
        title: 'Đề xuất cũ',
        type: 'proposal',
        status: 'Nháp',
        version: 3,
        createdById: 10,
        projectId: null,
        linkedProjectIds: [],
        dataJson: { content: 'Nội dung cũ', attachmentIds: [11, 12] },
      });
      prisma.attachment.findMany.mockResolvedValue([{ id: 11 }, { id: 12 }]);
      prisma.attachment.count.mockResolvedValue(1);
      prisma.document.update.mockResolvedValue({
        id: 1,
        title: 'Đề xuất đã sửa',
        type: 'proposal',
        status: 'Nháp',
        version: 4,
        createdById: 10,
        dataJson: { content: 'Nội dung đã sửa', attachmentIds: [12, 13] },
      });

      const result = await service.updateDocument(
        1,
        { id: 10, roles: ['employee'] },
        {
          title: 'Đề xuất đã sửa',
          content: 'Nội dung đã sửa',
          attachmentIds: [12, 13],
        },
        3,
      );

      expect(prisma.attachment.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [13] }, uploadedById: 10, entityId: 0 },
        data: { entityId: 1, entityType: 'document' },
      });
      expect(prisma.attachment.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: [11] },
          entityType: 'document',
          entityId: 1,
        },
        data: { entityId: 0 },
      });
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Đề xuất đã sửa',
            dataJson: expect.objectContaining({
              content: 'Nội dung đã sửa',
              attachmentIds: [12, 13],
            }),
            version: 4,
          }),
        }),
      );
      expect(result.version).toBe(4);
    });

    it('should not allow editing a document while it is under approval', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        title: 'Đang duyệt',
        status: 'Chờ duyệt',
        createdById: 10,
      });

      await expect(
        service.updateDocument(
          1,
          { id: 10, roles: ['employee'] },
          { title: 'Không được sửa' },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createNewVersion', () => {
    it('should create new version (-v2) for approved document even when optimistic-lock version is high (e.g. 6)', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        code: 'DNTT-2026-001',
        title: 'Thanh toán hosting',
        type: 'payment_request',
        status: 'Đã duyệt',
        version: 6, // Optimistic-locking counter tăng sau nhiều bước duyệt
        createdById: 10,
        dataJson: { amount: 5000000 },
      });

      prisma.document.findMany.mockResolvedValue([{ code: 'DNTT-2026-001' }]);

      prisma.document.create.mockResolvedValue({
        id: 2,
        code: 'DNTT-2026-001-v2',
        title: 'Thanh toán hosting (Bản sửa đổi v2)',
        status: 'Nháp',
        version: 1, // Bản nháp mới bắt đầu lock version từ 1
        createdById: 10,
      });

      const result = await service.createNewVersion(1, 10);
      expect(prisma.document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: 'DNTT-2026-001-v2',
            version: 1,
            status: 'Nháp',
          }),
        }),
      );
      expect(result.code).toBe('DNTT-2026-001-v2');
      expect(result.status).toBe('Nháp');
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create_new_version' }),
      );
    });

    it('should increment to -v3 when -v2 already exists in database', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 2,
        code: 'DNTT-2026-001-v2',
        title: 'Thanh toán hosting (Bản sửa đổi v2)',
        type: 'payment_request',
        status: 'Đã duyệt',
        version: 4,
        createdById: 10,
        dataJson: { amount: 5000000 },
      });

      prisma.document.findMany.mockResolvedValue([
        { code: 'DNTT-2026-001' },
        { code: 'DNTT-2026-001-v2' },
      ]);

      prisma.document.create.mockResolvedValue({
        id: 3,
        code: 'DNTT-2026-001-v3',
        title: 'Thanh toán hosting (Bản sửa đổi v3)',
        status: 'Nháp',
        version: 1,
        createdById: 10,
      });

      const result = await service.createNewVersion(2, 10);
      expect(prisma.document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: 'DNTT-2026-001-v3',
            version: 1,
          }),
        }),
      );
      expect(result.code).toBe('DNTT-2026-001-v3');
    });

    it('should throw BadRequestException if document is not yet approved', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        status: 'Chờ duyệt',
        createdById: 10,
      });

      await expect(service.createNewVersion(1, 10)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('submitForApproval', () => {
    it('should throw BadRequestException if document has no attachments', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        status: 'Nháp',
        createdById: 10,
        dataJson: {
          amount: 5000000,
          receiver: 'ABC',
          bankName: 'VCB',
          bankAccount: '123',
          content: 'Fee',
          attachmentIds: [],
        },
      });
      prisma.attachment.count.mockResolvedValue(0);

      await expect(service.submitForApproval(1, 10)).rejects.toThrow(
        'Bắt buộc phải đính kèm ít nhất 1 chứng từ',
      );
    });

    it('should snapshot workflow template steps and transition document to "Chờ duyệt" when attachment is present', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        title: 'Đề nghị thanh toán',
        type: 'payment_request',
        status: 'Nháp',
        createdById: 10,
        version: 1,
        projectId: 5,
        linkedProjectIds: null,
        createdBy: { id: 10, departmentId: null },
        dataJson: {
          amount: 5000000,
          receiver: 'Công ty ABC',
          bankName: 'Vietcombank',
          bankAccount: '1234567890',
          content: 'Hosting fee',
          attachmentIds: [99],
        },
      });
      prisma.attachment.count.mockResolvedValue(1);
      // Có Trưởng dự án đủ điều kiện xử lý bước 1 — không bị tự động bỏ qua.
      prisma.user.count.mockResolvedValue(1);

      prisma.workflowTemplate.findUnique.mockResolvedValue({
        type: 'payment_request',
        steps: [
          { stepOrder: 1, roleRequired: 'department_head' },
          { stepOrder: 2, roleRequired: 'accountant' },
          { stepOrder: 3, roleRequired: 'ceo' },
        ],
      });

      let nextStepId = 1;
      prisma.documentApprovalStep.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: nextStepId++, ...data }),
      );
      prisma.document.update.mockResolvedValue({
        id: 1,
        status: 'Chờ duyệt',
        version: 2,
      });

      const result = await service.submitForApproval(1, 10);
      expect(result.status).toBe('Chờ duyệt');
      expect(prisma.documentApprovalStep.create).toHaveBeenCalledTimes(3);
      expect(prisma.documentApprovalStep.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { status: 'pending' },
        }),
      );
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'submit_approval', entityId: 1 }),
      );
    });

    it('should skip the "department_head" step and activate CEO directly when the document has no eligible Trưởng Ban (no project)', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 2,
        title: 'Đề xuất công ty',
        type: 'proposal',
        status: 'Nháp',
        createdById: 10,
        version: 1,
        projectId: null,
        linkedProjectIds: null,
        createdBy: { id: 10, departmentId: null },
        dataJson: { content: 'Nội dung đề xuất' },
      });
      // Không có Trưởng Ban nào đủ điều kiện (không thuộc dự án nào, không
      // có phòng ban khớp) — bước department_head phải được tự động bỏ qua.
      prisma.user.count.mockResolvedValue(0);

      prisma.workflowTemplate.findUnique.mockResolvedValue({
        type: 'proposal',
        steps: [
          { stepOrder: 1, roleRequired: 'department_head' },
          { stepOrder: 2, roleRequired: 'ceo' },
        ],
      });

      let nextStepId = 1;
      const createdStepsById: Record<number, any> = {};
      prisma.documentApprovalStep.create.mockImplementation(({ data }: any) => {
        const step = { id: nextStepId++, ...data };
        createdStepsById[step.id] = step;
        return Promise.resolve(step);
      });
      prisma.documentApprovalStep.update.mockImplementation(({ where, data }: any) => {
        Object.assign(createdStepsById[where.id], data);
        return Promise.resolve(createdStepsById[where.id]);
      });
      prisma.document.update.mockResolvedValue({ id: 2, status: 'Chờ duyệt', version: 2 });

      await service.submitForApproval(2, 10);

      // Bước 1 (department_head) phải được tự động duyệt (skip), bước 2 (ceo) mới là bước đang chờ.
      expect(createdStepsById[1].status).toBe('approved');
      expect(createdStepsById[1].comment).toContain('Tự động bỏ qua');
      expect(createdStepsById[2].status).toBe('pending');
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'Chờ duyệt' }) }),
      );
    });

    it('should skip self-approval and activate CEO when the creator is Trưởng Ban', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 3,
        code: 'DNTT-2026-003',
        title: 'Đề nghị do Trưởng Ban tạo',
        type: 'payment_request',
        status: 'Nháp',
        createdById: 10,
        version: 1,
        projectId: 5,
        linkedProjectIds: null,
        createdBy: {
          id: 10,
          departmentId: 1,
          roles: [{ name: 'department_head' }],
        },
        dataJson: {
          amount: 5000000,
          receiver: 'Nhà cung cấp',
          bankName: 'VCB',
          bankAccount: '123456',
          content: 'Thanh toán dịch vụ',
          attachmentIds: [99],
        },
      });
      prisma.attachment.count.mockResolvedValue(1);
      prisma.workflowTemplate.findUnique.mockResolvedValue({
        type: 'payment_request',
        steps: [
          { stepOrder: 1, roleRequired: 'department_head' },
          { stepOrder: 2, roleRequired: 'ceo' },
          { stepOrder: 3, roleRequired: 'accountant' },
        ],
      });

      let nextStepId = 1;
      const createdStepsById: Record<number, any> = {};
      prisma.documentApprovalStep.create.mockImplementation(({ data }: any) => {
        const step = { id: nextStepId++, ...data };
        createdStepsById[step.id] = step;
        return Promise.resolve(step);
      });
      prisma.documentApprovalStep.update.mockImplementation(({ where, data }: any) => {
        Object.assign(createdStepsById[where.id], data);
        return Promise.resolve(createdStepsById[where.id]);
      });
      prisma.document.update.mockResolvedValue({
        id: 3,
        code: 'DNTT-2026-003',
        title: 'Đề nghị do Trưởng Ban tạo',
        status: 'Chờ duyệt',
        version: 2,
        createdBy: { name: 'Trưởng Ban' },
      });

      await service.submitForApproval(3, 10);

      expect(createdStepsById[1]).toEqual(
        expect.objectContaining({
          status: 'approved',
          comment: expect.stringContaining('người tạo hồ sơ đồng thời là Trưởng Ban'),
        }),
      );
      expect(createdStepsById[2].status).toBe('pending');
      expect(createdStepsById[3].status).toBe('not_started');
      expect(prisma.user.count).not.toHaveBeenCalled();
      expect(notificationsService.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'document_pending_approval' }),
      );
    });

    it('should throw ForbiddenException if user is not creator', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        status: 'Nháp',
        createdById: 10,
      });

      await expect(service.submitForApproval(1, 99)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('Anti Self-Approval Rule', () => {
    it('should block document creator from approving their own document step', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        status: 'Chờ duyệt',
        createdById: 10, // User 10 created this document
        version: 1,
        steps: [
          {
            id: 101,
            stepOrder: 1,
            roleRequired: 'department_head',
            status: 'pending',
          },
        ],
      });

      // User 10 also happens to have department_head role
      const user = { id: 10, roles: [{ name: 'department_head' }] };

      await expect(service.approveStep(1, 101, user)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.approveStep(1, 101, user)).rejects.toThrow(
        'Người tạo hồ sơ không được phép tự phê duyệt hồ sơ của chính mình',
      );
    });
  });

  describe('Sequential Step Approval & Final Approval', () => {
    it('should approve current step and advance next step to pending', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        status: 'Chờ duyệt',
        createdById: 10,
        createdBy: { id: 10, departmentId: 1 },
        version: 1,
        steps: [
          {
            id: 101,
            stepOrder: 1,
            roleRequired: 'department_head',
            status: 'pending',
          },
          {
            id: 102,
            stepOrder: 2,
            roleRequired: 'accountant',
            status: 'not_started',
          },
          { id: 103, stepOrder: 3, roleRequired: 'ceo', status: 'not_started' },
        ],
      });

      const deptHeadUser = {
        id: 20,
        departmentId: 1,
        roles: [{ name: 'department_head' }],
      };

      await service.approveStep(1, 101, deptHeadUser, {
        comment: 'Đồng ý duyệt',
      });

      expect(prisma.documentApprovalStep.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 101 },
          data: expect.objectContaining({ status: 'approved', actedById: 20 }),
        }),
      );

      expect(prisma.documentApprovalStep.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 102 },
          data: expect.objectContaining({ status: 'pending' }),
        }),
      );
    });

    it('allows a project head to approve a document linked only as a collaborating project', async () => {
      const linkedOnlyDocument = {
        id: 16,
        code: 'DNTT-2026-005',
        title: 'Thanh toán chi phí quảng cáo',
        type: 'payment_request',
        status: 'Chờ duyệt',
        createdById: 10,
        createdBy: { id: 10, departmentId: 1 },
        projectId: null,
        linkedProjectIds: [200],
        version: 1,
        dataJson: {},
        steps: [
          {
            id: 101,
            stepOrder: 1,
            roleRequired: 'department_head',
            status: 'pending',
          },
        ],
      };
      prisma.document.findUnique.mockResolvedValue(linkedOnlyDocument);
      prisma.document.update.mockResolvedValue({
        ...linkedOnlyDocument,
        status: 'Đã duyệt',
        version: 2,
      });

      await service.approveStep(
        16,
        101,
        {
          id: 20,
          roles: [{ name: 'department_head' }],
          ledProjects: [{ id: 200, isActive: true }],
        },
        { comment: 'Đồng ý' },
      );

      expect(prisma.documentApprovalStep.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 101 },
          data: expect.objectContaining({ status: 'approved', actedById: 20 }),
        }),
      );
    });

    it('should reject department_head approval if approver is from a different department', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        status: 'Chờ duyệt',
        createdById: 10,
        createdBy: { id: 10, departmentId: 1 }, // Dept 1
        version: 1,
        steps: [
          {
            id: 101,
            stepOrder: 1,
            roleRequired: 'department_head',
            status: 'pending',
          },
        ],
      });

      const otherDeptHead = {
        id: 99,
        departmentId: 2,
        roles: [{ name: 'department_head' }],
      }; // Dept 2

      await expect(
        service.approveStep(1, 101, otherDeptHead, {
          comment: 'Duyệt chéo phòng',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows delegated approval only in the delegator project and audits who was represented', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        code: 'DX-2026-001',
        title: 'Đề xuất dự án',
        projectId: 200,
        linkedProjectIds: [],
        status: 'Chờ duyệt',
        createdById: 10,
        createdBy: { id: 10, departmentId: 1 },
        version: 1,
        type: 'proposal',
        steps: [
          {
            id: 101,
            stepOrder: 1,
            roleRequired: 'department_head',
            status: 'pending',
          },
        ],
      });
      const delegate = {
        id: 20,
        roles: [{ name: 'employee' }],
        delegatedFrom: [
          {
            id: 7,
            name: 'Trưởng dự án A',
            roles: [{ name: 'department_head' }],
            ledProjects: [{ id: 200, isActive: true }],
            delegateUntil: new Date(Date.now() + 60_000),
          },
        ],
      };

      await service.approveStep(1, 101, delegate, { comment: 'Duyệt thay' });

      expect(prisma.documentApprovalStep.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ actedById: 20, status: 'approved' }),
        }),
      );
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 20,
          afterJson: expect.objectContaining({ actedOnBehalfOf: 7 }),
        }),
      );
    });

    it('denies an expired delegated approval immediately', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        projectId: 200,
        linkedProjectIds: [],
        status: 'Chờ duyệt',
        createdById: 10,
        createdBy: { id: 10, departmentId: 1 },
        version: 1,
        steps: [
          {
            id: 101,
            stepOrder: 1,
            roleRequired: 'department_head',
            status: 'pending',
          },
        ],
      });
      const expiredDelegate = {
        id: 20,
        roles: [{ name: 'employee' }],
        delegatedFrom: [
          {
            id: 7,
            roles: [{ name: 'department_head' }],
            ledProjects: [{ id: 200, isActive: true }],
            delegateUntil: new Date(Date.now() - 1),
          },
        ],
      };

      await expect(
        service.approveStep(1, 101, expiredDelegate, { comment: 'Quá hạn' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.documentApprovalStep.update).not.toHaveBeenCalled();
    });

    it('should transition document status to "Đã duyệt" when final step is approved', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        status: 'Chờ duyệt',
        createdById: 10,
        createdBy: { id: 10, departmentId: 1 },
        version: 3,
        steps: [
          {
            id: 101,
            stepOrder: 1,
            roleRequired: 'department_head',
            status: 'approved',
          },
          {
            id: 102,
            stepOrder: 2,
            roleRequired: 'accountant',
            status: 'approved',
          },
          { id: 103, stepOrder: 3, roleRequired: 'ceo', status: 'pending' }, // Final step!
        ],
      });

      const ceoUser = { id: 30, roles: [{ name: 'ceo' }] };

      await service.approveStep(1, 103, ceoUser, {
        comment: 'CEO duyệt thanh toán',
        pin: '123456',
      });

      expect(authService.verifyApprovalPin).toHaveBeenCalledWith(30, '123456');
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({ status: 'Đã duyệt' }),
        }),
      );
    });

    it('should reject final CEO approval when PIN is missing', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        status: 'Chờ duyệt',
        createdById: 10,
        createdBy: { id: 10, departmentId: 1 },
        version: 3,
        steps: [
          {
            id: 101,
            stepOrder: 1,
            roleRequired: 'department_head',
            status: 'approved',
          },
          {
            id: 102,
            stepOrder: 2,
            roleRequired: 'accountant',
            status: 'approved',
          },
          { id: 103, stepOrder: 3, roleRequired: 'ceo', status: 'pending' },
        ],
      });

      const ceoUser = { id: 30, roles: [{ name: 'ceo' }] };

      await expect(
        service.approveStep(1, 103, ceoUser, {
          comment: 'CEO duyệt thanh toán',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(authService.verifyApprovalPin).not.toHaveBeenCalled();
    });

    it('should NOT require PIN on final CEO step when CEO has disabled the PIN feature', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        status: 'Chờ duyệt',
        createdById: 10,
        createdBy: { id: 10, departmentId: 1 },
        version: 3,
        steps: [
          {
            id: 101,
            stepOrder: 1,
            roleRequired: 'department_head',
            status: 'approved',
          },
          {
            id: 102,
            stepOrder: 2,
            roleRequired: 'accountant',
            status: 'approved',
          },
          { id: 103, stepOrder: 3, roleRequired: 'ceo', status: 'pending' },
        ],
      });
      authService.isApprovalPinEnabled.mockResolvedValueOnce(false);

      const ceoUser = { id: 30, roles: [{ name: 'ceo' }] };

      await service.approveStep(1, 103, ceoUser, {
        comment: 'CEO duyệt thanh toán',
      });

      expect(authService.isApprovalPinEnabled).toHaveBeenCalledWith(30);
      expect(authService.verifyApprovalPin).not.toHaveBeenCalled();
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({ status: 'Đã duyệt' }),
        }),
      );
    });

    it('should NOT require PIN for non-final approval steps (e.g. department_head)', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        status: 'Chờ duyệt',
        createdById: 10,
        createdBy: { id: 10, departmentId: 1 },
        version: 1,
        steps: [
          {
            id: 101,
            stepOrder: 1,
            roleRequired: 'department_head',
            status: 'pending',
          },
          { id: 102, stepOrder: 2, roleRequired: 'ceo', status: 'not_started' },
        ],
      });

      const deptHeadUser = {
        id: 20,
        departmentId: 1,
        roles: [{ name: 'department_head' }],
      };

      await service.approveStep(1, 101, deptHeadUser, { comment: 'Đồng ý' });

      expect(authService.verifyApprovalPin).not.toHaveBeenCalled();
    });
  });

  describe('CEO direct approval', () => {
    it('should let CEO approve every remaining step and complete the document', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        code: 'DX-2026-001',
        title: 'Đề xuất cần duyệt nhanh',
        status: 'Chờ duyệt',
        createdById: 10,
        createdBy: { id: 10, name: 'Nhân viên', email: 'employee@hve.vn' },
        version: 2,
        steps: [
          {
            id: 101,
            stepOrder: 1,
            roleRequired: 'department_head',
            status: 'pending',
          },
          {
            id: 102,
            stepOrder: 2,
            roleRequired: 'accountant',
            status: 'not_started',
          },
          { id: 103, stepOrder: 3, roleRequired: 'ceo', status: 'not_started' },
        ],
      });
      prisma.document.update.mockResolvedValue({
        id: 1,
        status: 'Đã duyệt',
        version: 3,
      });

      const result = await service.approveDirect(
        1,
        { id: 30, roles: [{ name: 'ceo' }] },
        { comment: 'CEO duyệt khẩn', pin: '123456' },
        2,
      );

      expect(authService.verifyApprovalPin).toHaveBeenCalledWith(30, '123456');
      expect(prisma.documentApprovalStep.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { documentId: 1, status: { not: 'approved' } },
          data: expect.objectContaining({ status: 'approved', actedById: 30 }),
        }),
      );
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'Đã duyệt', version: 3 } }),
      );
      expect(result.status).toBe('Đã duyệt');
    });

    it('should reject direct approval by a non-CEO user', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        status: 'Chờ duyệt',
        createdById: 10,
        version: 1,
        steps: [],
      });

      await expect(
        service.approveDirect(
          1,
          { id: 20, roles: [{ name: 'department_head' }] },
          {},
          1,
        ),
      ).rejects.toThrow('Chỉ CEO mới có quyền duyệt thẳng hồ sơ');
    });

    it('should never let CEO bypass the accountant for a payment request', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 9,
        type: 'payment_request',
        status: 'Chờ duyệt',
        createdById: 10,
        version: 2,
        steps: [
          { id: 91, stepOrder: 2, roleRequired: 'ceo', status: 'pending' },
          { id: 92, stepOrder: 3, roleRequired: 'accountant', status: 'not_started' },
        ],
      });

      await expect(
        service.approveDirect(
          9,
          { id: 30, roles: [{ name: 'ceo' }] },
          { pin: '123456' },
          2,
        ),
      ).rejects.toThrow('không được duyệt thẳng toàn bộ quy trình');

      expect(prisma.documentApprovalStep.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('Return and Reject Steps', () => {
    it('should return document to "Nháp" and require reason comment', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        status: 'Chờ duyệt',
        createdById: 10,
        createdBy: { id: 10, departmentId: 1 },
        version: 1,
        steps: [
          {
            id: 101,
            stepOrder: 1,
            roleRequired: 'department_head',
            status: 'pending',
          },
        ],
      });

      const approver = {
        id: 20,
        departmentId: 1,
        roles: [{ name: 'department_head' }],
      };

      // Missing comment should fail
      await expect(
        service.returnStep(1, 101, approver, { comment: '' }),
      ).rejects.toThrow(BadRequestException);

      // With comment should succeed and reset to 'Nháp'
      await service.returnStep(1, 101, approver, {
        comment: 'Thiếu hóa đơn VAT đính kèm',
      });

      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({ status: 'Nháp' }),
        }),
      );
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'return_document' }),
      );
    });

    it('should reject document to "Từ chối" and require reason comment', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        status: 'Chờ duyệt',
        createdById: 10,
        createdBy: { id: 10, departmentId: 1 },
        version: 1,
        steps: [
          {
            id: 101,
            stepOrder: 1,
            roleRequired: 'department_head',
            status: 'pending',
          },
        ],
      });

      const approver = {
        id: 20,
        departmentId: 1,
        roles: [{ name: 'department_head' }],
      };

      await service.rejectStep(1, 101, approver, {
        comment: 'Khoản chi không phù hợp với kế hoạch ngân sách',
      });

      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({ status: 'Từ chối' }),
        }),
      );
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'reject_document' }),
      );
    });

    it('should block return and reject actions from a head of another project', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        projectId: 200,
        linkedProjectIds: [],
        status: 'Chờ duyệt',
        createdById: 10,
        createdBy: { id: 10, departmentId: 1 },
        version: 1,
        steps: [
          {
            id: 101,
            stepOrder: 1,
            roleRequired: 'department_head',
            status: 'pending',
          },
        ],
      });
      const otherProjectHead = {
        id: 20,
        departmentId: 1,
        roles: [{ name: 'department_head' }],
        ledProjects: [{ id: 100, isActive: true }],
      };

      await expect(
        service.returnStep(1, 101, otherProjectHead, { comment: 'Trả lại' }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.rejectStep(1, 101, otherProjectHead, { comment: 'Từ chối' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.document.update).not.toHaveBeenCalled();
    });
  });

  describe('Optimistic Locking', () => {
    it('should throw ConflictException if document version has changed concurrently', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        status: 'Chờ duyệt',
        createdById: 10,
        version: 5, // DB version is 5
        steps: [
          {
            id: 101,
            stepOrder: 1,
            roleRequired: 'department_head',
            status: 'pending',
          },
        ],
      });

      const user = { id: 20, roles: [{ name: 'department_head' }] };

      // Client passed stale version 4
      await expect(service.approveStep(1, 101, user, {}, 4)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('Phase 2: Multi-Document Types & Expiry Calculation', () => {
    it('should create a proposal with DX code and draft status', async () => {
      prisma.document.findFirst.mockResolvedValue(null);
      prisma.document.create.mockResolvedValue({
        id: 201,
        code: 'DX-2026-001',
        title: 'Đề xuất trang bị màn hình mở rộng cho team Dev',
        type: 'proposal',
        status: 'Nháp',
        version: 1,
        createdById: 10,
        dataJson: { content: 'Cần 5 màn hình Dell U2422H', attachmentIds: [] },
      });

      const result = await service.createProposal(10, {
        title: 'Đề xuất trang bị màn hình mở rộng cho team Dev',
        content: 'Cần 5 màn hình Dell U2422H',
      });

      expect(result.code).toBe('DX-2026-001');
      expect(result.type).toBe('proposal');
      expect(result.status).toBe('Nháp');
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create_document' }),
      );
    });

    it('scopes BGĐ proposals to one recipient or the whole company', async () => {
      prisma.document.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue({ id: 25 });
      prisma.document.create
        .mockResolvedValueOnce({
          id: 202,
          code: 'DX-2026-002',
          title: 'Đề xuất gửi riêng',
          type: 'proposal',
          status: 'Nháp',
          createdById: 8,
          targetUserId: 25,
        })
        .mockResolvedValueOnce({
          id: 203,
          code: 'DX-2026-003',
          title: 'Đề xuất toàn công ty',
          type: 'proposal',
          status: 'Nháp',
          createdById: 8,
          targetUserId: null,
        });

      const boardUser = { id: 8, name: 'Ban Giám Đốc', roles: ['bgd'] };
      await service.createProposal(boardUser, {
        title: 'Đề xuất gửi riêng',
        content: 'Chỉ gửi người nhận',
        targetUserId: 25,
      });
      await service.createProposal(boardUser, {
        title: 'Đề xuất toàn công ty',
        content: 'Mọi người đều xem',
      });

      expect(prisma.document.create.mock.calls[0][0].data).toEqual(
        expect.objectContaining({ visibility: 'targeted', targetUserId: 25 }),
      );
      expect(prisma.document.create.mock.calls[1][0].data).toEqual(
        expect.objectContaining({ visibility: 'company', targetUserId: null }),
      );
      expect(notificationsService.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 25, eventType: 'proposal_received' }),
      );
    });

    it('should create a contract with HD code and valid dates', async () => {
      prisma.document.findFirst.mockResolvedValue(null);
      prisma.document.create.mockResolvedValue({
        id: 301,
        code: 'HD-2026-001',
        title: 'Hợp đồng dịch vụ bảo trì hạ tầng IT',
        type: 'contract',
        status: 'Nháp',
        version: 1,
        createdById: 10,
        dataJson: {
          partner: 'Công ty Công nghệ CMC',
          value: 120000000,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          manager: 'Nguyễn Văn A',
        },
      });

      const result = await service.createContract(10, {
        title: 'Hợp đồng dịch vụ bảo trì hạ tầng IT',
        partner: 'Công ty Công nghệ CMC',
        value: 120000000,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        manager: 'Nguyễn Văn A',
      });

      expect(result.code).toBe('HD-2026-001');
      expect(result.type).toBe('contract');
      expect(result.isExpiringSoon).toBeDefined();
    });

    it('should reject contract creation when endDate is before startDate', async () => {
      await expect(
        service.createContract(10, {
          title: 'Hợp đồng sai ngày',
          partner: 'Công ty ABC',
          value: 50000000,
          startDate: '2026-12-31',
          endDate: '2026-01-01', // End date before start date!
          manager: 'Nguyễn Văn A',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should calculate contract expiry correctly for valid, expiring_soon, and expired', () => {
      const now = new Date();

      // Expired: 10 days ago
      const pastDate = new Date(now.getTime() - 10 * 86400000)
        .toISOString()
        .split('T')[0];
      const expiredRes = service.calculateContractExpiry({ endDate: pastDate });
      expect(expiredRes.expiringStatus).toBe('expired');
      expect(expiredRes.isExpiringSoon).toBe(true);

      // Expiring soon: 15 days in future (<= 30 days)
      const soonDate = new Date(now.getTime() + 15 * 86400000)
        .toISOString()
        .split('T')[0];
      const soonRes = service.calculateContractExpiry({ endDate: soonDate });
      expect(soonRes.expiringStatus).toBe('expiring_soon');
      expect(soonRes.isExpiringSoon).toBe(true);

      // Valid: 90 days in future (> 30 days)
      const futureDate = new Date(now.getTime() + 90 * 86400000)
        .toISOString()
        .split('T')[0];
      const validRes = service.calculateContractExpiry({ endDate: futureDate });
      expect(validRes.expiringStatus).toBe('valid');
      expect(validRes.isExpiringSoon).toBe(false);
    });

    it('should allow proposal submission without mandatory attachments', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 201,
        type: 'proposal',
        status: 'Nháp',
        createdById: 10,
        version: 1,
        dataJson: { content: 'Nội dung đề xuất' },
      });
      prisma.attachment.count.mockResolvedValue(0);
      prisma.workflowTemplate.findUnique.mockResolvedValue({
        id: 2,
        type: 'proposal',
        steps: [
          { stepOrder: 1, roleRequired: 'department_head' },
          { stepOrder: 2, roleRequired: 'ceo' },
        ],
      });
      prisma.documentApprovalStep.create.mockResolvedValue({ id: 1 });
      prisma.document.update.mockResolvedValue({
        id: 201,
        type: 'proposal',
        status: 'Chờ duyệt',
        version: 2,
      });

      const result = await service.submitForApproval(201, 10);
      expect(result.status).toBe('Chờ duyệt');
      expect(prisma.documentApprovalStep.create).toHaveBeenCalledTimes(2);
    });

    it('should require contract file attachment when submitting contract', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 301,
        type: 'contract',
        status: 'Nháp',
        createdById: 10,
        version: 1,
        dataJson: {
          partner: 'Đối tác',
          value: 10000000,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          manager: 'Nguyễn Văn A',
          attachmentIds: [],
        },
      });
      prisma.attachment.count.mockResolvedValue(0);

      await expect(service.submitForApproval(301, 10)).rejects.toThrow(
        'Bắt buộc phải đính kèm file hợp đồng trước khi gửi duyệt',
      );
    });
  });

  describe('Real-time Notifications for Document Transitions (Phase 4 scope)', () => {
    it('notifies the lead of a linked-only project about a pending approval', async () => {
      prisma.project.findMany.mockResolvedValue([{ leadUserId: 15 }]);
      prisma.user.findMany.mockResolvedValue([]);

      await service.notifyStepApprovers(
        {
          id: 16,
          code: 'DNTT-2026-005',
          title: 'Thanh toán chi phí quảng cáo',
          projectId: null,
          linkedProjectIds: [2],
          createdBy: { name: 'Phạm Xuân Định', departmentId: 1 },
        },
        1,
        'department_head',
      );

      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: { id: { in: [2] }, isActive: true },
        select: { leadUserId: true },
      });
      expect(notificationsService.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 15,
          eventType: 'document_pending_approval',
        }),
      );
    });

    it('submitForApproval should trigger immediate notification to step 1 approver', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        code: 'DX-2026-001',
        title: 'Mua thiết bị',
        type: 'proposal',
        status: 'Nháp',
        createdById: 10,
        version: 1,
        dataJson: { content: 'Đề xuất mua màn hình' },
        createdBy: { departmentId: 2, name: 'Nhân viên A' },
      });
      prisma.workflowTemplate.findUnique.mockResolvedValue({
        steps: [{ stepOrder: 1, roleRequired: 'department_head' }],
      });
      prisma.user.count.mockResolvedValue(1); // có Trưởng phòng khớp phòng ban legacy
      prisma.documentApprovalStep.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 1, ...data }),
      );
      prisma.document.update.mockResolvedValue({
        id: 1,
        code: 'DX-2026-001',
        title: 'Mua thiết bị',
        status: 'Chờ duyệt',
        createdBy: { departmentId: 2, name: 'Nhân viên A' },
      });

      await service.submitForApproval(1, 10);
      expect(notificationsService.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'document_pending_approval',
          title: expect.stringContaining('DX-2026-001'),
        }),
      );
    });

    it('returnStep should trigger immediate notification to document creator', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        code: 'DX-2026-001',
        title: 'Mua thiết bị',
        status: 'Chờ duyệt',
        createdById: 10,
        version: 1,
        steps: [
          {
            id: 5,
            stepOrder: 1,
            roleRequired: 'department_head',
            status: 'pending',
          },
        ],
        createdBy: { departmentId: 2 },
      });
      prisma.document.update.mockResolvedValue({ id: 1, status: 'Nháp' });

      const user = {
        id: 2,
        roles: [{ name: 'department_head' }],
        departmentId: 2,
      };
      await service.returnStep(1, 5, user, { comment: 'Bổ sung báo giá' }, 1);

      expect(notificationsService.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 10,
          eventType: 'document_returned',
          content: expect.stringContaining('Bổ sung báo giá'),
        }),
      );
    });

    it('rejectStep should trigger immediate notification to document creator', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        code: 'DX-2026-001',
        title: 'Mua thiết bị',
        status: 'Chờ duyệt',
        createdById: 10,
        version: 1,
        steps: [
          {
            id: 5,
            stepOrder: 1,
            roleRequired: 'department_head',
            status: 'pending',
          },
        ],
        createdBy: { departmentId: 2 },
      });
      prisma.document.update.mockResolvedValue({ id: 1, status: 'Từ chối' });

      const user = {
        id: 2,
        roles: [{ name: 'department_head' }],
        departmentId: 2,
      };
      await service.rejectStep(
        1,
        5,
        user,
        { comment: 'Không phù hợp ngân sách' },
        1,
      );

      expect(notificationsService.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 10,
          eventType: 'document_rejected',
          content: expect.stringContaining('Không phù hợp ngân sách'),
        }),
      );
    });
  });

  describe('final accountant approval for payment requests', () => {
    const finalAccountantDocument = {
      id: 91,
      code: 'DNTT-2026-091',
      title: 'Thanh toán dự án Alpha',
      type: 'payment_request',
      status: 'Chờ duyệt',
      createdById: 10,
      createdBy: { id: 10, departmentId: 1 },
      dataJson: {
        amount: 1500000,
        receiver: 'Nhà cung cấp Alpha',
        bankName: 'Vietcombank',
        bankAccount: '0071001234567',
      },
      version: 3,
      steps: [
        { id: 901, stepOrder: 1, roleRequired: 'ceo', status: 'approved' },
        {
          id: 902,
          stepOrder: 2,
          roleRequired: 'accountant',
          status: 'pending',
          updatedAt: new Date('2026-09-21T04:00:00.000Z'),
        },
      ],
    };

    it('rejects final accountant approval when that accountant has not uploaded proof', async () => {
      prisma.document.findUnique.mockResolvedValue(finalAccountantDocument);
      prisma.attachment.count.mockResolvedValue(0);

      await expect(
        service.approveStep(
          91,
          902,
          { id: 25, roles: [{ name: 'accountant' }] },
          { comment: 'UNC 88291' },
          3,
        ),
      ).rejects.toThrow('Bắt buộc đính kèm chứng từ giao dịch');
    });

    it('rejects completion when transaction information is missing', async () => {
      prisma.document.findUnique.mockResolvedValue(finalAccountantDocument);
      prisma.attachment.count.mockResolvedValue(1);

      await expect(
        service.approveStep(
          91,
          902,
          { id: 25, roles: [{ name: 'accountant' }] },
          { comment: 'Đã chuyển khoản' },
          3,
        ),
      ).rejects.toThrow('Bắt buộc nhập mã giao dịch và thời gian thanh toán');
    });

    it('finishes as Đã duyệt after proof-backed accountant approval', async () => {
      prisma.document.findUnique.mockResolvedValue(finalAccountantDocument);
      prisma.attachment.count.mockResolvedValue(1);
      prisma.document.update.mockResolvedValue({
        ...finalAccountantDocument,
        status: 'Đã duyệt',
      });

      await service.approveStep(
        91,
        902,
        { id: 25, roles: [{ name: 'accountant' }] },
        {
          comment: 'Đã chuyển khoản',
          paymentReference: 'UNC-88291',
          paymentPaidAt: '2026-09-21T04:30:00.000Z',
          paymentMethod: 'vietqr',
        },
        3,
      );

      expect(prisma.attachment.count).toHaveBeenCalledWith({
        where: {
          entityType: 'document',
          entityId: 91,
          uploadedById: 25,
          uploadedAt: { gt: new Date('2026-09-21T04:00:00.000Z') },
        },
      });
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'Đã duyệt',
            dataJson: expect.objectContaining({
              settlement: expect.objectContaining({
                status: 'paid',
                source: 'manual_proof',
                reference: 'UNC-88291',
                proofAttachmentCount: 1,
              }),
            }),
          }),
        }),
      );
    });
  });
});
