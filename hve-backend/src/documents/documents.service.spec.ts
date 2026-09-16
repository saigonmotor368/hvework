import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsService } from './documents.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import {
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prisma: any;
  let auditService: any;

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
      $transaction: vi.fn(async (cb: any) => cb(prisma)),
    };

    auditService = {
      logEvent: vi.fn().mockResolvedValue({ id: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
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

      const result = await service.createPaymentRequest(10, {
        title: 'Thanh toán nhà cung cấp',
        amount: 5000000,
        receiver: 'Công ty ABC',
        bankName: 'Vietcombank',
        bankAccount: '1234567890',
        content: 'Thanh toán chi phí hosting',
        deadline: '2026-10-01',
      });

      expect(result.id).toBe(1);
      expect(result.status).toBe('Nháp');
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create_document', entityId: 1 }),
      );
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

      prisma.document.findMany.mockResolvedValue([
        { code: 'DNTT-2026-001' },
      ]);

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

      prisma.workflowTemplate.findUnique.mockResolvedValue({
        type: 'payment_request',
        steps: [
          { stepOrder: 1, roleRequired: 'department_head' },
          { stepOrder: 2, roleRequired: 'accountant' },
          { stepOrder: 3, roleRequired: 'ceo' },
        ],
      });

      prisma.document.update.mockResolvedValue({
        id: 1,
        status: 'Chờ duyệt',
        version: 2,
      });

      const result = await service.submitForApproval(1, 10);
      expect(result.status).toBe('Chờ duyệt');
      expect(prisma.documentApprovalStep.create).toHaveBeenCalledTimes(3);
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'submit_approval', entityId: 1 }),
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
        version: 1,
        steps: [
          { id: 101, stepOrder: 1, roleRequired: 'department_head', status: 'pending' },
          { id: 102, stepOrder: 2, roleRequired: 'accountant', status: 'not_started' },
          { id: 103, stepOrder: 3, roleRequired: 'ceo', status: 'not_started' },
        ],
      });

      const deptHeadUser = { id: 20, roles: [{ name: 'department_head' }] };

      await service.approveStep(1, 101, deptHeadUser, { comment: 'Đồng ý duyệt' });

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

    it('should transition document status to "Đã duyệt" when final step is approved', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        status: 'Chờ duyệt',
        createdById: 10,
        version: 3,
        steps: [
          { id: 101, stepOrder: 1, roleRequired: 'department_head', status: 'approved' },
          { id: 102, stepOrder: 2, roleRequired: 'accountant', status: 'approved' },
          { id: 103, stepOrder: 3, roleRequired: 'ceo', status: 'pending' }, // Final step!
        ],
      });

      const ceoUser = { id: 30, roles: [{ name: 'ceo' }] };

      await service.approveStep(1, 103, ceoUser, { comment: 'CEO duyệt thanh toán' });

      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({ status: 'Đã duyệt' }),
        }),
      );
    });
  });

  describe('Return and Reject Steps', () => {
    it('should return document to "Nháp" and require reason comment', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        status: 'Chờ duyệt',
        createdById: 10,
        version: 1,
        steps: [
          { id: 101, stepOrder: 1, roleRequired: 'department_head', status: 'pending' },
        ],
      });

      const approver = { id: 20, roles: [{ name: 'department_head' }] };

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
        version: 1,
        steps: [
          { id: 101, stepOrder: 1, roleRequired: 'department_head', status: 'pending' },
        ],
      });

      const approver = { id: 20, roles: [{ name: 'department_head' }] };

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
  });

  describe('Optimistic Locking', () => {
    it('should throw ConflictException if document version has changed concurrently', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        status: 'Chờ duyệt',
        createdById: 10,
        version: 5, // DB version is 5
        steps: [
          { id: 101, stepOrder: 1, roleRequired: 'department_head', status: 'pending' },
        ],
      });

      const user = { id: 20, roles: [{ name: 'department_head' }] };

      // Client passed stale version 4
      await expect(service.approveStep(1, 101, user, {}, 4)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
