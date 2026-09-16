import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowsService } from './workflows.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotFoundException } from '@nestjs/common';

describe('WorkflowsService', () => {
  let service: WorkflowsService;
  let prisma: any;
  let auditService: any;

  beforeEach(async () => {
    prisma = {
      workflowTemplate: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      workflowStepTemplate: {
        deleteMany: vi.fn(),
        create: vi.fn(),
      },
      role: {
        findMany: vi.fn(),
      },
      $transaction: vi.fn(async (cb: any) => cb(prisma)),
    };

    auditService = {
      logEvent: vi.fn().mockResolvedValue({ id: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<WorkflowsService>(WorkflowsService);
  });

  describe('findAll and findByType', () => {
    it('should return all workflow templates', async () => {
      prisma.workflowTemplate.findMany.mockResolvedValue([
        { id: 1, type: 'payment_request', name: 'ĐNTT', steps: [] },
      ]);

      const result = await service.findAll();
      expect(result).toHaveLength(1);
    });

    it('should throw NotFoundException if template type does not exist', async () => {
      prisma.workflowTemplate.findUnique.mockResolvedValue(null);
      await expect(service.findByType('unknown_type')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateTemplate validation and execution', () => {
    it('should reject if steps list is empty', async () => {
      prisma.workflowTemplate.findUnique.mockResolvedValue({
        id: 1,
        type: 'proposal',
        steps: [],
      });

      await expect(
        service.updateTemplate('proposal', { steps: [] }, 10),
      ).rejects.toThrow('Quy trình duyệt phải có ít nhất 1 bước');
    });

    it('should reject if stepOrder is not continuous or duplicate', async () => {
      prisma.workflowTemplate.findUnique.mockResolvedValue({
        id: 1,
        type: 'proposal',
        steps: [],
      });
      prisma.role.findMany.mockResolvedValue([
        { name: 'department_head' },
        { name: 'ceo' },
      ]);

      // Jump from 1 to 3
      await expect(
        service.updateTemplate(
          'proposal',
          {
            steps: [
              { stepOrder: 1, roleRequired: 'department_head' },
              { stepOrder: 3, roleRequired: 'ceo' },
            ],
          },
          10,
        ),
      ).rejects.toThrow('Thứ tự các bước duyệt phải bắt đầu từ 1 và liên tục');
    });

    it('should reject if roleRequired does not exist in Role table', async () => {
      prisma.workflowTemplate.findUnique.mockResolvedValue({
        id: 1,
        type: 'proposal',
        steps: [],
      });
      prisma.role.findMany.mockResolvedValue([
        { name: 'department_head' },
        { name: 'ceo' },
      ]);

      await expect(
        service.updateTemplate(
          'proposal',
          {
            steps: [
              { stepOrder: 1, roleRequired: 'invalid_super_role' },
            ],
          },
          10,
        ),
      ).rejects.toThrow("Vai trò 'invalid_super_role' không tồn tại");
    });

    it('should update template steps atomically and log audit event', async () => {
      prisma.workflowTemplate.findUnique.mockResolvedValue({
        id: 1,
        type: 'proposal',
        steps: [{ stepOrder: 1, roleRequired: 'ceo' }],
      });
      prisma.role.findMany.mockResolvedValue([
        { name: 'department_head' },
        { name: 'ceo' },
      ]);

      await service.updateTemplate(
        'proposal',
        {
          steps: [
            { stepOrder: 1, roleRequired: 'department_head' },
            { stepOrder: 2, roleRequired: 'ceo' },
          ],
        },
        10,
      );

      expect(prisma.workflowStepTemplate.deleteMany).toHaveBeenCalledWith({
        where: { workflowTemplateId: 1 },
      });
      expect(prisma.workflowStepTemplate.create).toHaveBeenCalledTimes(2);
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'update_workflow_template' }),
      );
    });
  });
});
