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

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prisma: any;
  let auditService: any;
  let notificationsService: any;

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
      user: {
        findMany: vi.fn().mockResolvedValue([{ id: 2 }]),
      },
      $transaction: vi.fn(async (cb: any) => cb(prisma)),
    };

    auditService = {
      logEvent: vi.fn().mockResolvedValue({ id: 1 }),
    };

    notificationsService = {
      dispatchNotification: vi.fn().mockResolvedValue({ in_app: true, email: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
        { provide: NotificationsService, useValue: notificationsService },
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
        createdBy: { id: 10, departmentId: 1 },
        version: 1,
        steps: [
          { id: 101, stepOrder: 1, roleRequired: 'department_head', status: 'pending' },
          { id: 102, stepOrder: 2, roleRequired: 'accountant', status: 'not_started' },
          { id: 103, stepOrder: 3, roleRequired: 'ceo', status: 'not_started' },
        ],
      });

      const deptHeadUser = { id: 20, departmentId: 1, roles: [{ name: 'department_head' }] };

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

    it('should reject department_head approval if approver is from a different department', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        status: 'Chờ duyệt',
        createdById: 10,
        createdBy: { id: 10, departmentId: 1 }, // Dept 1
        version: 1,
        steps: [
          { id: 101, stepOrder: 1, roleRequired: 'department_head', status: 'pending' },
        ],
      });

      const otherDeptHead = { id: 99, departmentId: 2, roles: [{ name: 'department_head' }] }; // Dept 2

      await expect(
        service.approveStep(1, 101, otherDeptHead, { comment: 'Duyệt chéo phòng' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should transition document status to "Đã duyệt" when final step is approved', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 1,
        status: 'Chờ duyệt',
        createdById: 10,
        createdBy: { id: 10, departmentId: 1 },
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
        createdBy: { id: 10, departmentId: 1 },
        version: 1,
        steps: [
          { id: 101, stepOrder: 1, roleRequired: 'department_head', status: 'pending' },
        ],
      });

      const approver = { id: 20, departmentId: 1, roles: [{ name: 'department_head' }] };

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
          { id: 101, stepOrder: 1, roleRequired: 'department_head', status: 'pending' },
        ],
      });

      const approver = { id: 20, departmentId: 1, roles: [{ name: 'department_head' }] };

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
      const pastDate = new Date(now.getTime() - 10 * 86400000).toISOString().split('T')[0];
      const expiredRes = service.calculateContractExpiry({ endDate: pastDate });
      expect(expiredRes.expiringStatus).toBe('expired');
      expect(expiredRes.isExpiringSoon).toBe(true);

      // Expiring soon: 15 days in future (<= 30 days)
      const soonDate = new Date(now.getTime() + 15 * 86400000).toISOString().split('T')[0];
      const soonRes = service.calculateContractExpiry({ endDate: soonDate });
      expect(soonRes.expiringStatus).toBe('expiring_soon');
      expect(soonRes.isExpiringSoon).toBe(true);

      // Valid: 90 days in future (> 30 days)
      const futureDate = new Date(now.getTime() + 90 * 86400000).toISOString().split('T')[0];
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
        steps: [{ id: 5, stepOrder: 1, roleRequired: 'department_head', status: 'pending' }],
        createdBy: { departmentId: 2 },
      });
      prisma.document.update.mockResolvedValue({ id: 1, status: 'Nháp' });

      const user = { id: 2, roles: [{ name: 'department_head' }], departmentId: 2 };
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
        steps: [{ id: 5, stepOrder: 1, roleRequired: 'department_head', status: 'pending' }],
        createdBy: { departmentId: 2 },
      });
      prisma.document.update.mockResolvedValue({ id: 1, status: 'Từ chối' });

      const user = { id: 2, roles: [{ name: 'department_head' }], departmentId: 2 };
      await service.rejectStep(1, 5, user, { comment: 'Không phù hợp ngân sách' }, 1);

      expect(notificationsService.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 10,
          eventType: 'document_rejected',
          content: expect.stringContaining('Không phù hợp ngân sách'),
        }),
      );
    });
  });
});
