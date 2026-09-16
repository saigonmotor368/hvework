import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { UpdateWorkflowTemplateDto } from './dto/update-workflow-template.dto.js';

@Injectable()
export class WorkflowsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll() {
    return this.prisma.workflowTemplate.findMany({
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  async findByType(type: string) {
    const template = await this.prisma.workflowTemplate.findUnique({
      where: { type },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
      },
    });

    if (!template) {
      throw new NotFoundException(`Không tìm thấy quy trình cho loại '${type}'`);
    }

    return template;
  }

  async updateTemplate(
    type: string,
    dto: UpdateWorkflowTemplateDto,
    userId: number,
    ip?: string,
  ) {
    const template = await this.prisma.workflowTemplate.findUnique({
      where: { type },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
      },
    });

    if (!template) {
      throw new NotFoundException(`Không tìm thấy quy trình cho loại '${type}'`);
    }

    if (!dto.steps || dto.steps.length === 0) {
      throw new BadRequestException('Quy trình duyệt phải có ít nhất 1 bước');
    }

    // Validate valid roles exist in database
    const rolesInDb = await this.prisma.role.findMany({
      select: { name: true },
    });
    const validRoleNames = new Set(rolesInDb.map((r) => r.name));

    // Sort by stepOrder to validate sequence
    const sortedSteps = [...dto.steps].sort((a, b) => a.stepOrder - b.stepOrder);

    for (let i = 0; i < sortedSteps.length; i++) {
      const step = sortedSteps[i];
      const expectedOrder = i + 1;
      if (step.stepOrder !== expectedOrder) {
        throw new BadRequestException(
          `Thứ tự các bước duyệt phải bắt đầu từ 1 và liên tục không bị gián đoạn hay trùng lặp (Bước thứ ${expectedOrder} có thứ tự là ${step.stepOrder})`,
        );
      }

      if (!validRoleNames.has(step.roleRequired)) {
        throw new BadRequestException(
          `Vai trò '${step.roleRequired}' không tồn tại trong hệ thống`,
        );
      }
    }

    const beforeSteps = template.steps.map((s) => ({
      stepOrder: s.stepOrder,
      roleRequired: s.roleRequired,
    }));

    // Transaction to replace steps atomically
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.workflowStepTemplate.deleteMany({
        where: { workflowTemplateId: template.id },
      });

      for (const step of sortedSteps) {
        await tx.workflowStepTemplate.create({
          data: {
            workflowTemplateId: template.id,
            stepOrder: step.stepOrder,
            roleRequired: step.roleRequired,
          },
        });
      }

      return tx.workflowTemplate.findUnique({
        where: { id: template.id },
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
          },
        },
      });
    });

    await this.auditService.logEvent({
      entityType: 'WorkflowTemplate',
      entityId: template.id,
      action: 'update_workflow_template',
      actorId: userId,
      beforeJson: { type, steps: beforeSteps },
      afterJson: {
        type,
        steps: sortedSteps.map((s) => ({
          stepOrder: s.stepOrder,
          roleRequired: s.roleRequired,
        })),
      },
      ip,
    });

    return updated;
  }
}
