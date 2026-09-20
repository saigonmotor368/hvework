import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto.js';
import { CreateProposalDto } from './dto/create-proposal.dto.js';
import { CreateContractDto } from './dto/create-contract.dto.js';
import { UpdateDocumentDto } from './dto/update-document.dto.js';
import { ActionStepDto, RejectOrReturnStepDto } from './dto/action-step.dto.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AuthService } from '../auth/auth.service.js';
import {
  buildDocumentAccessWhere,
  buildApprovalStepAccessConditions,
  getApprovalDelegator,
  getEffectiveRoleNames,
  getRoleNames,
  getUserProjectIds,
} from '../common/access-scope.js';

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationsService: NotificationsService,
    private authService: AuthService,
  ) {}

  private async validateProjectSelection(
    user: any,
    projectId?: number,
    linkedProjectIds: number[] = [],
  ) {
    const selectedIds = [
      ...new Set([...(projectId ? [projectId] : []), ...linkedProjectIds]),
    ];
    if (selectedIds.length === 0) return;

    const projects = await this.prisma.project.findMany({
      where: { id: { in: selectedIds }, isActive: true },
      select: { id: true },
    });
    if (projects.length !== selectedIds.length) {
      throw new BadRequestException(
        'Có dự án không tồn tại hoặc đã ngừng hoạt động',
      );
    }

    const roles = getRoleNames(user);
    const ownProjectIds = getUserProjectIds(user);
    const canLinkProjects = roles.some((role) =>
      ['ceo', 'bgd', 'it_admin', 'department_head'].includes(role),
    );
    if (
      projectId &&
      !roles.some((role) => ['ceo', 'bgd', 'it_admin'].includes(role)) &&
      !ownProjectIds.includes(projectId)
    ) {
      throw new ForbiddenException('Bạn không thuộc dự án đã chọn');
    }
    if (
      !canLinkProjects &&
      linkedProjectIds.some((id) => !ownProjectIds.includes(id))
    ) {
      throw new ForbiddenException(
        'Bạn không có quyền liên kết hồ sơ với dự án khác',
      );
    }
  }

  private async validateNewAttachments(
    userId: number,
    attachmentIds: number[] = [],
  ) {
    if (attachmentIds.length === 0) return;
    const uniqueIds = [...new Set(attachmentIds)];
    const count = await this.prisma.attachment.count({
      where: {
        id: { in: uniqueIds },
        uploadedById: userId,
        entityId: 0,
      },
    });
    if (count !== uniqueIds.length) {
      throw new ForbiddenException(
        'Có tệp đính kèm không thuộc phiên tải lên của bạn',
      );
    }
  }

  private assertDepartmentHeadDocumentScope(doc: any, user: any) {
    const userProjectIds = getUserProjectIds(user);
    const linkedProjectIds = Array.isArray(doc.linkedProjectIds)
      ? (doc.linkedProjectIds as number[])
      : [];
    const canHandleProject = doc.projectId
      ? userProjectIds.includes(doc.projectId) ||
        linkedProjectIds.some((id) => userProjectIds.includes(id))
      : false;
    const creatorDeptId = doc.createdBy?.departmentId;
    const userDeptId = user.departmentId || user.department?.id;
    const canHandleLegacy =
      !doc.projectId &&
      Boolean(creatorDeptId && userDeptId && creatorDeptId === userDeptId);

    if (!canHandleProject && !canHandleLegacy) {
      throw new ForbiddenException(
        'Bạn chỉ được xử lý hồ sơ thuộc dự án mình phụ trách/tham gia',
      );
    }
  }

  private resolveApprovalDelegator(doc: any, user: any, roleRequired: string) {
    if (!getEffectiveRoleNames(user).includes(roleRequired)) {
      throw new ForbiddenException(
        `Bạn không có vai trò '${roleRequired}' để xử lý bước này`,
      );
    }

    const delegator = getApprovalDelegator(user, roleRequired, doc);
    if (roleRequired === 'department_head') {
      if (delegator) return delegator;
      if (!getRoleNames(user).includes('department_head')) {
        throw new ForbiddenException(
          'Quyền ủy quyền không áp dụng cho dự án/phòng ban của hồ sơ này',
        );
      }
      this.assertDepartmentHeadDocumentScope(doc, user);
    }
    return delegator;
  }

  // Hồ sơ không thuộc dự án nào (VD: người tạo chưa tham gia dự án nào,
  // mặc định "Đơn vị tổng công ty") thì không có ai giữ vai trò Trưởng
  // Ban/Trưởng dự án phù hợp để xử lý — Trưởng Ban giờ chỉ được cấp qua
  // việc làm Trưởng dự án, không còn theo Phòng ban cố định như trước.
  // Kiểm tra trước khi kích hoạt bước để tránh hồ sơ bị treo vĩnh viễn.
  private async hasEligibleDepartmentHeadApprover(doc: {
    projectId: number | null;
    linkedProjectIds: unknown;
    createdBy?: { departmentId?: number | null } | null;
  }): Promise<boolean> {
    const linkedProjectIds = Array.isArray(doc.linkedProjectIds)
      ? (doc.linkedProjectIds as number[])
      : [];
    const projectIds = [doc.projectId, ...linkedProjectIds].filter(
      (id): id is number => typeof id === 'number',
    );

    if (projectIds.length > 0) {
      const count = await this.prisma.user.count({
        where: {
          status: 'active',
          roles: { some: { name: 'department_head' } },
          OR: [
            { ledProjects: { some: { id: { in: projectIds } } } },
            { projectMemberships: { some: { projectId: { in: projectIds } } } },
          ],
        },
      });
      if (count > 0) return true;
    }

    const creatorDeptId = doc.createdBy?.departmentId;
    if (!doc.projectId && creatorDeptId) {
      const count = await this.prisma.user.count({
        where: {
          status: 'active',
          departmentId: creatorDeptId,
          roles: { some: { name: 'department_head' } },
        },
      });
      if (count > 0) return true;
    }

    return false;
  }

  // Kích hoạt bước duyệt bắt đầu từ `fromStepOrder`, tự động bỏ qua liên
  // tiếp các bước "department_head" không có ai đủ điều kiện xử lý (thay vì
  // để hồ sơ treo vĩnh viễn chờ một vai trò không tồn tại cho hồ sơ này).
  // Trả về trạng thái hồ sơ cuối cùng và bước thực sự được kích hoạt (nếu có).
  private async activateNextEligibleStep(
    tx: any,
    doc: {
      projectId: number | null;
      linkedProjectIds: unknown;
      createdBy?: {
        departmentId?: number | null;
        roles?: Array<string | { name: string }>;
      } | null;
    },
    steps: Array<{ id: number; stepOrder: number; roleRequired: string }>,
    fromStepOrder: number,
  ): Promise<{
    finalStatus: 'Chờ duyệt' | 'Đã duyệt';
    activatedStepOrder: number | null;
    skippedStepOrders: number[];
  }> {
    const skippedStepOrders: number[] = [];
    let order = fromStepOrder;
    for (;;) {
      const step = steps.find((s) => s.stepOrder === order);
      if (!step) {
        return { finalStatus: 'Đã duyệt', activatedStepOrder: null, skippedStepOrders };
      }
      if (step.roleRequired === 'department_head') {
        const creatorRoles = (doc.createdBy?.roles || []).map((role) =>
          typeof role === 'string' ? role : role.name,
        );
        if (creatorRoles.includes('department_head')) {
          await tx.documentApprovalStep.update({
            where: { id: step.id },
            data: {
              status: 'approved',
              comment:
                'Tự động bỏ qua: người tạo hồ sơ đồng thời là Trưởng Ban. Chuyển thẳng CEO rà soát.',
            },
          });
          skippedStepOrders.push(order);
          order += 1;
          continue;
        }
        const eligible = await this.hasEligibleDepartmentHeadApprover(doc);
        if (!eligible) {
          await tx.documentApprovalStep.update({
            where: { id: step.id },
            data: {
              status: 'approved',
              comment:
                'Tự động bỏ qua: hồ sơ không thuộc dự án nào nên không có Trưởng Ban phụ trách. Chuyển thẳng cấp tiếp theo.',
            },
          });
          skippedStepOrders.push(order);
          order += 1;
          continue;
        }
      }
      await tx.documentApprovalStep.update({
        where: { id: step.id },
        data: { status: 'pending' },
      });
      return { finalStatus: 'Chờ duyệt', activatedStepOrder: order, skippedStepOrders };
    }
  }

  async generateDocumentCode(prefix: string): Promise<string> {
    const year = new Date().getFullYear();
    const codePrefix = `${prefix}-${year}-`;

    const latestDoc = await this.prisma.document.findFirst({
      where: {
        code: {
          startsWith: codePrefix,
        },
      },
      orderBy: {
        code: 'desc',
      },
    });

    let nextSeq = 1;
    if (latestDoc && latestDoc.code) {
      const parts = latestDoc.code.split('-');
      if (parts.length === 3) {
        const lastSeq = parseInt(parts[2], 10);
        if (!isNaN(lastSeq)) {
          nextSeq = lastSeq + 1;
        }
      }
    }

    return `${codePrefix}${String(nextSeq).padStart(3, '0')}`;
  }

  /**
   * Bắn thông báo tức thời cho người/vai trò duyệt của bước hiện tại
   */
  async notifyStepApprovers(
    doc: {
      id: number;
      code: string;
      title: string;
      projectId?: number | null;
      createdBy?: { name?: string; departmentId?: number | null };
    },
    stepOrder: number,
    roleRequired: string,
  ) {
    try {
      let approverIds: number[] = [];

      if (roleRequired === 'department_head') {
        if (doc.projectId) {
          const project = await this.prisma.project.findUnique({
            where: { id: doc.projectId },
            select: { leadUserId: true },
          });
          approverIds = project?.leadUserId ? [project.leadUserId] : [];
        } else {
          const deptId = doc.createdBy?.departmentId;
          if (deptId) {
            const deptHeads = await this.prisma.user.findMany({
              where: {
                departmentId: deptId,
                roles: { some: { name: 'department_head' } },
                status: 'active',
              },
              select: { id: true },
            });
            approverIds = deptHeads.map((u) => u.id);
          }
        }
      } else {
        const roleUsers = await this.prisma.user.findMany({
          where: {
            roles: { some: { name: roleRequired } },
            status: 'active',
          },
          select: { id: true },
        });
        approverIds = roleUsers.map((u) => u.id);
      }

      if (approverIds.length > 0) {
        const activeDelegations = await this.prisma.user.findMany({
          where: {
            id: { in: approverIds },
            delegateToUserId: { not: null },
            delegateUntil: { gte: new Date() },
          },
          select: { delegateToUserId: true },
        });
        approverIds = [
          ...new Set([
            ...approverIds,
            ...activeDelegations
              .map((item) => item.delegateToUserId)
              .filter((id): id is number => typeof id === 'number'),
          ]),
        ];
      }

      for (const approverId of approverIds) {
        await this.notificationsService.dispatchNotification({
          userId: approverId,
          eventType: 'document_pending_approval',
          entityRef: `document:${doc.id}`,
          title: `Hồ sơ cần duyệt: ${doc.code}`,
          content: `Hồ sơ "${doc.title}" (Người tạo: ${doc.createdBy?.name || '---'}) đang chờ bạn phê duyệt (Bước ${stepOrder}).`,
          link: `/documents?id=${doc.id}`,
          dedupeKey: `doc_pending_${doc.id}_step${stepOrder}_user${approverId}_${Date.now()}`,
        });
      }
    } catch {
      // Notification dispatch should not block main transaction
    }
  }

  async createPaymentRequest(
    user: any,
    dto: CreatePaymentRequestDto,
    ip?: string,
  ) {
    const userId = user.id;
    await this.validateProjectSelection(
      user,
      dto.projectId,
      dto.linkedProjectIds,
    );
    await this.validateNewAttachments(userId, dto.attachmentIds);
    const code = await this.generateDocumentCode('DNTT');

    const dataJson = {
      amount: dto.amount,
      receiver: dto.receiver,
      bankName: dto.bankName,
      bankAccount: dto.bankAccount,
      content: dto.content,
      deadline: dto.deadline,
      attachmentIds: dto.attachmentIds || [],
    };

    const document = await this.prisma.document.create({
      data: {
        code,
        title: dto.title,
        type: 'payment_request',
        status: 'Nháp',
        dataJson,
        createdById: userId,
        projectId: dto.projectId || null,
        linkedProjectIds: dto.linkedProjectIds || [],
        version: 1,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, department: true },
        },
      },
    });

    // Update attachments if provided
    if (dto.attachmentIds && dto.attachmentIds.length > 0) {
      await this.prisma.attachment.updateMany({
        where: {
          id: { in: dto.attachmentIds },
          uploadedById: userId,
          entityId: 0,
        },
        data: { entityId: document.id, entityType: 'document' },
      });
    }

    await this.auditService.logEvent({
      entityType: 'Document',
      entityId: document.id,
      action: 'create_document',
      actorId: userId,
      afterJson: {
        code,
        title: dto.title,
        type: 'payment_request',
        status: 'Nháp',
      },
      ip,
    });

    return document;
  }

  async createProposal(user: any, dto: CreateProposalDto, ip?: string) {
    const userId = user.id;
    const roles = getRoleNames(user);
    const isBoard = roles.includes('bgd');
    await this.validateProjectSelection(
      user,
      dto.projectId,
      dto.linkedProjectIds,
    );
    await this.validateNewAttachments(userId, dto.attachmentIds);
    if (dto.targetUserId && !isBoard) {
      throw new ForbiddenException(
        'Chỉ Ban Giám Đốc được chỉ định người nhận riêng cho đề xuất',
      );
    }
    if (dto.targetUserId) {
      const target = await this.prisma.user.findFirst({
        where: { id: dto.targetUserId, status: 'active' },
        select: { id: true },
      });
      if (!target) {
        throw new BadRequestException(
          'Người nhận đề xuất không tồn tại hoặc đã bị khóa',
        );
      }
    }
    const code = await this.generateDocumentCode('DX');

    const dataJson = {
      content: dto.content,
      attachmentIds: dto.attachmentIds || [],
    };

    const document = await this.prisma.document.create({
      data: {
        code,
        title: dto.title,
        type: 'proposal',
        status: 'Nháp',
        dataJson,
        createdById: userId,
        projectId: dto.projectId || null,
        linkedProjectIds: dto.linkedProjectIds || [],
        targetUserId: isBoard ? dto.targetUserId || null : null,
        visibility: isBoard
          ? dto.targetUserId
            ? 'targeted'
            : 'company'
          : 'scoped',
        version: 1,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, department: true },
        },
        targetUser: {
          select: { id: true, name: true, email: true, department: true },
        },
      },
    });

    if (dto.attachmentIds && dto.attachmentIds.length > 0) {
      await this.prisma.attachment.updateMany({
        where: {
          id: { in: dto.attachmentIds },
          uploadedById: userId,
          entityId: 0,
        },
        data: { entityId: document.id, entityType: 'document' },
      });
    }

    await this.auditService.logEvent({
      entityType: 'Document',
      entityId: document.id,
      action: 'create_document',
      actorId: userId,
      afterJson: { code, title: dto.title, type: 'proposal', status: 'Nháp' },
      ip,
    });

    if (document.targetUserId && document.targetUserId !== userId) {
      await this.notificationsService.dispatchNotification({
        userId: document.targetUserId,
        eventType: 'proposal_received',
        entityRef: `document:${document.id}`,
        title: `Đề xuất mới: ${document.code}`,
        content: `${user.name} đã gửi đề xuất "${document.title}" trực tiếp đến bạn.`,
        link: `/documents?id=${document.id}`,
        dedupeKey: `proposal_received_${document.id}_${document.targetUserId}`,
      });
    }

    return document;
  }

  async createContract(user: any, dto: CreateContractDto, ip?: string) {
    const userId = user.id;
    await this.validateProjectSelection(
      user,
      dto.projectId,
      dto.linkedProjectIds,
    );
    await this.validateNewAttachments(userId, dto.attachmentIds);
    if (new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException(
        'Ngày hết hạn hợp đồng không được trước ngày hiệu lực',
      );
    }

    const code = await this.generateDocumentCode('HD');

    const dataJson = {
      partner: dto.partner,
      value: dto.value,
      startDate: dto.startDate,
      endDate: dto.endDate,
      manager: dto.manager,
      notes: dto.notes || '',
      attachmentIds: dto.attachmentIds || [],
    };

    const document = await this.prisma.document.create({
      data: {
        code,
        title: dto.title,
        type: 'contract',
        status: 'Nháp',
        dataJson,
        createdById: userId,
        projectId: dto.projectId || null,
        linkedProjectIds: dto.linkedProjectIds || [],
        version: 1,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, department: true },
        },
        targetUser: {
          select: { id: true, name: true, email: true, department: true },
        },
      },
    });

    if (dto.attachmentIds && dto.attachmentIds.length > 0) {
      await this.prisma.attachment.updateMany({
        where: {
          id: { in: dto.attachmentIds },
          uploadedById: userId,
          entityId: 0,
        },
        data: { entityId: document.id, entityType: 'document' },
      });
    }

    await this.auditService.logEvent({
      entityType: 'Document',
      entityId: document.id,
      action: 'create_document',
      actorId: userId,
      afterJson: { code, title: dto.title, type: 'contract', status: 'Nháp' },
      ip,
    });

    return this.enrichDocument(document);
  }

  calculateContractExpiry(
    dataJson: any,
    offsetDays: number = 30,
  ): {
    isExpiringSoon: boolean;
    expiringStatus: 'valid' | 'expiring_soon' | 'expired';
    daysRemaining: number | null;
  } {
    if (!dataJson || !dataJson.endDate) {
      return {
        isExpiringSoon: false,
        expiringStatus: 'valid',
        daysRemaining: null,
      };
    }

    const end = new Date(dataJson.endDate);
    if (isNaN(end.getTime())) {
      return {
        isExpiringSoon: false,
        expiringStatus: 'valid',
        daysRemaining: null,
      };
    }

    const now = new Date();
    const endMidnight = new Date(
      end.getFullYear(),
      end.getMonth(),
      end.getDate(),
    ).getTime();
    const nowMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const diffDays = Math.round(
      (endMidnight - nowMidnight) / (1000 * 3600 * 24),
    );

    if (diffDays < 0) {
      return {
        isExpiringSoon: true,
        expiringStatus: 'expired',
        daysRemaining: diffDays,
      };
    } else if (diffDays <= offsetDays) {
      return {
        isExpiringSoon: true,
        expiringStatus: 'expiring_soon',
        daysRemaining: diffDays,
      };
    } else {
      return {
        isExpiringSoon: false,
        expiringStatus: 'valid',
        daysRemaining: diffDays,
      };
    }
  }

  enrichDocument(doc: any) {
    if (!doc) return doc;
    if (doc.type === 'contract') {
      const expiry = this.calculateContractExpiry(doc.dataJson);
      return {
        ...doc,
        ...expiry,
      };
    }
    return doc;
  }

  async updateDocument(
    documentId: number,
    user: any,
    dto: UpdateDocumentDto,
    currentVersion?: number,
    ip?: string,
  ) {
    const userId = user.id;
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc) {
      throw new NotFoundException('Không tìm thấy hồ sơ');
    }

    if (doc.status !== 'Nháp') {
      throw new BadRequestException(
        'Chỉ có thể chỉnh sửa hồ sơ khi ở trạng thái Nháp',
      );
    }

    if (doc.createdById !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền chỉnh sửa hồ sơ của người khác',
      );
    }

    await this.validateProjectSelection(
      user,
      dto.projectId,
      dto.linkedProjectIds,
    );

    if (currentVersion !== undefined && doc.version !== currentVersion) {
      throw new ConflictException(
        'Hồ sơ đã được chỉnh sửa từ phiên làm việc khác. Vui lòng tải lại trang.',
      );
    }

    const currentAttachments = await this.prisma.attachment.findMany({
      where: { entityType: 'document', entityId: documentId },
      select: { id: true },
    });
    const currentAttachmentIds = currentAttachments.map((item) => item.id);
    const desiredAttachmentIds = dto.attachmentIds ?? currentAttachmentIds;
    const newAttachmentIds = desiredAttachmentIds.filter(
      (id) => !currentAttachmentIds.includes(id),
    );
    await this.validateNewAttachments(userId, newAttachmentIds);

    const prevData: any = doc.dataJson || {};
    const updatedDataJson = {
      ...prevData,
      ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
      ...(dto.receiver !== undefined ? { receiver: dto.receiver } : {}),
      ...(dto.bankName !== undefined ? { bankName: dto.bankName } : {}),
      ...(dto.bankAccount !== undefined
        ? { bankAccount: dto.bankAccount }
        : {}),
      ...(dto.content !== undefined ? { content: dto.content } : {}),
      ...(dto.deadline !== undefined ? { deadline: dto.deadline } : {}),
      ...(dto.partner !== undefined ? { partner: dto.partner } : {}),
      ...(dto.value !== undefined ? { value: dto.value } : {}),
      ...(dto.startDate !== undefined ? { startDate: dto.startDate } : {}),
      ...(dto.endDate !== undefined ? { endDate: dto.endDate } : {}),
      ...(dto.manager !== undefined ? { manager: dto.manager } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      attachmentIds: desiredAttachmentIds,
    };

    const updatedTitle = dto.title?.trim() ?? doc.title.trim();
    if (!updatedTitle) {
      throw new BadRequestException('Tiêu đề hồ sơ không được để trống');
    }
    if (
      doc.type === 'payment_request' &&
      (!updatedDataJson.amount ||
        !updatedDataJson.receiver?.trim() ||
        !updatedDataJson.bankName?.trim() ||
        !updatedDataJson.bankAccount?.trim() ||
        !updatedDataJson.content?.trim())
    ) {
      throw new BadRequestException(
        'Hồ sơ thiếu các thông tin thanh toán bắt buộc',
      );
    }
    if (doc.type === 'proposal' && !updatedDataJson.content?.trim()) {
      throw new BadRequestException('Đề xuất thiếu thông tin nội dung bắt buộc');
    }
    if (
      doc.type === 'contract' &&
      (!updatedDataJson.partner?.trim() ||
        updatedDataJson.value === undefined ||
        !updatedDataJson.startDate ||
        !updatedDataJson.endDate ||
        !updatedDataJson.manager?.trim())
    ) {
      throw new BadRequestException(
        'Hợp đồng thiếu các thông tin bắt buộc',
      );
    }
    if (
      doc.type === 'contract' &&
      updatedDataJson.startDate &&
      updatedDataJson.endDate &&
      new Date(updatedDataJson.endDate) < new Date(updatedDataJson.startDate)
    ) {
      throw new BadRequestException(
        'Ngày hết hạn hợp đồng không được trước ngày hiệu lực',
      );
    }

    const roles = getRoleNames(user);
    const isBoard = roles.includes('bgd');
    if (doc.type === 'proposal' && dto.targetUserId && !isBoard) {
      throw new ForbiddenException(
        'Chỉ Ban Giám Đốc được chỉ định người nhận riêng cho đề xuất',
      );
    }
    if (doc.type === 'proposal' && dto.targetUserId) {
      const target = await this.prisma.user.findFirst({
        where: { id: dto.targetUserId, status: 'active' },
        select: { id: true },
      });
      if (!target) {
        throw new BadRequestException(
          'Người nhận đề xuất không tồn tại hoặc đã bị khóa',
        );
      }
    }

    const removedAttachmentIds = currentAttachmentIds.filter(
      (id) => !desiredAttachmentIds.includes(id),
    );

    const updatedDoc = await this.prisma.$transaction(async (tx) => {
      if (newAttachmentIds.length > 0) {
        await tx.attachment.updateMany({
          where: {
            id: { in: newAttachmentIds },
            uploadedById: userId,
            entityId: 0,
          },
          data: { entityId: documentId, entityType: 'document' },
        });
      }
      if (removedAttachmentIds.length > 0) {
        await tx.attachment.updateMany({
          where: {
            id: { in: removedAttachmentIds },
            entityType: 'document',
            entityId: documentId,
          },
          data: { entityId: 0 },
        });
      }

      return tx.document.update({
        where: { id: documentId },
        data: {
          title: updatedTitle,
          dataJson: updatedDataJson,
          projectId:
            dto.projectId !== undefined ? dto.projectId || null : doc.projectId,
          linkedProjectIds:
            dto.linkedProjectIds ??
            (Array.isArray(doc.linkedProjectIds)
              ? (doc.linkedProjectIds as number[])
              : []),
          ...(doc.type === 'proposal' && isBoard
            ? {
                targetUserId: dto.targetUserId || null,
                visibility: dto.targetUserId ? 'targeted' : 'company',
              }
            : {}),
          version: doc.version + 1,
        },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true, department: true },
          },
          targetUser: {
            select: { id: true, name: true, email: true, department: true },
          },
        },
      });
    });

    await this.auditService.logEvent({
      entityType: 'Document',
      entityId: doc.id,
      action: 'update_document',
      actorId: userId,
      beforeJson: { title: doc.title, dataJson: doc.dataJson },
      afterJson: {
        title: updatedDoc.title,
        dataJson: updatedDataJson,
        addedAttachmentIds: newAttachmentIds,
        removedAttachmentIds,
      },
      ip,
    });

    return updatedDoc;
  }

  async deletePaymentRequest(documentId: number, userId: number, ip?: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc) {
      throw new NotFoundException('Không tìm thấy hồ sơ');
    }

    if (doc.status !== 'Nháp') {
      throw new BadRequestException(
        'Chỉ có thể xóa hồ sơ khi ở trạng thái Nháp',
      );
    }

    if (doc.createdById !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền xóa hồ sơ của người khác',
      );
    }

    await this.prisma.documentApprovalStep.deleteMany({
      where: { documentId },
    });
    await this.prisma.document.delete({ where: { id: documentId } });

    await this.auditService.logEvent({
      entityType: 'Document',
      entityId: doc.id,
      action: 'delete_document',
      actorId: userId,
      beforeJson: { code: doc.code, title: doc.title },
      ip,
    });

    return { message: 'Đã xóa bản nháp thành công' };
  }

  async createNewVersion(documentId: number, userId: number, ip?: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc) {
      throw new NotFoundException('Không tìm thấy hồ sơ');
    }

    if (doc.status !== 'Đã duyệt') {
      throw new BadRequestException(
        'Chỉ có thể tạo phiên bản mới cho hồ sơ đã được phê duyệt',
      );
    }

    if (doc.createdById !== userId) {
      throw new ForbiddenException(
        'Chỉ người tạo hồ sơ mới có quyền tạo phiên bản sửa đổi',
      );
    }

    // Tách baseCode và tính revision number độc lập với optimistic-lock version
    const baseCode = doc.code.split('-v')[0];
    const existingDocs = await this.prisma.document.findMany({
      where: {
        code: {
          startsWith: baseCode,
        },
      },
      select: { code: true },
    });

    let maxRevision = 1;
    for (const d of existingDocs) {
      const match = d.code.match(/-v(\d+)$/);
      if (match) {
        const rev = parseInt(match[1], 10);
        if (rev > maxRevision) maxRevision = rev;
      }
    }

    const nextRevision = maxRevision + 1;
    const newCode = `${baseCode}-v${nextRevision}`;
    const cleanTitle = doc.title.replace(/\s*\(Bản sửa đổi v\d+\)$/, '');

    const newDoc = await this.prisma.document.create({
      data: {
        code: newCode,
        title: `${cleanTitle} (Bản sửa đổi v${nextRevision})`,
        type: doc.type,
        status: 'Nháp',
        dataJson: {
          ...(typeof doc.dataJson === 'object' && doc.dataJson !== null
            ? (doc.dataJson as any)
            : {}),
          parentDocumentId: doc.id,
          revision: nextRevision,
        },
        createdById: userId,
        projectId: doc.projectId,
        linkedProjectIds: doc.linkedProjectIds || [],
        version: 1, // Hồ sơ nháp mới bắt đầu bộ đếm optimistic lock từ 1
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, department: true },
        },
      },
    });

    await this.auditService.logEvent({
      entityType: 'Document',
      entityId: newDoc.id,
      action: 'create_new_version',
      actorId: userId,
      beforeJson: {
        originalDocumentId: doc.id,
        originalCode: doc.code,
        originalLockVersion: doc.version,
      },
      afterJson: {
        newDocumentId: newDoc.id,
        newCode: newDoc.code,
        revision: nextRevision,
        lockVersion: 1,
      },
      ip,
    });

    return newDoc;
  }

  async submitForApproval(documentId: number, userId: number, ip?: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            departmentId: true,
            roles: { select: { name: true } },
          },
        },
      },
    });
    if (!doc) {
      throw new NotFoundException('Không tìm thấy hồ sơ');
    }

    if (doc.status !== 'Nháp') {
      throw new BadRequestException(
        'Hồ sơ không ở trạng thái Nháp để có thể gửi duyệt',
      );
    }

    if (doc.createdById !== userId) {
      throw new ForbiddenException(
        'Chỉ người tạo hồ sơ mới có quyền gửi duyệt',
      );
    }

    // Validate mandatory data based on document type
    const docType = doc.type || 'payment_request';
    const data: any = doc.dataJson || {};
    const attachmentCount = await this.prisma.attachment.count({
      where: { entityType: 'document', entityId: documentId },
    });
    const hasAttachmentInJson =
      Array.isArray(data.attachmentIds) && data.attachmentIds.length > 0;

    if (docType === 'payment_request') {
      if (
        !data.amount ||
        !data.receiver ||
        !data.bankName ||
        !data.bankAccount ||
        !data.content
      ) {
        throw new BadRequestException(
          'Hồ sơ thiếu các thông tin thanh toán bắt buộc',
        );
      }

      if (attachmentCount === 0 && !hasAttachmentInJson) {
        throw new BadRequestException(
          'Quy định nghiệp vụ: Bắt buộc phải đính kèm ít nhất 1 chứng từ / hóa đơn trước khi gửi duyệt.',
        );
      }
    } else if (docType === 'proposal') {
      if (!data.content || !data.content.trim()) {
        throw new BadRequestException(
          'Đề xuất thiếu thông tin nội dung bắt buộc',
        );
      }
      // Attachments are optional for proposal
    } else if (docType === 'contract') {
      if (
        !data.partner ||
        data.value === undefined ||
        !data.startDate ||
        !data.endDate ||
        !data.manager
      ) {
        throw new BadRequestException(
          'Hợp đồng thiếu các thông tin bắt buộc (đối tác, giá trị, ngày hiệu lực/hết hạn, người phụ trách)',
        );
      }
      if (new Date(data.endDate) < new Date(data.startDate)) {
        throw new BadRequestException(
          'Ngày hết hạn hợp đồng không được trước ngày hiệu lực',
        );
      }
      if (attachmentCount === 0 && !hasAttachmentInJson) {
        throw new BadRequestException(
          'Quy định nghiệp vụ: Bắt buộc phải đính kèm file hợp đồng trước khi gửi duyệt.',
        );
      }
    }

    const workflowTemplate = await this.prisma.workflowTemplate.findUnique({
      where: { type: docType },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
      },
    });

    if (!workflowTemplate || workflowTemplate.steps.length === 0) {
      throw new BadRequestException(
        'Chưa cấu hình quy trình duyệt cho loại hồ sơ này. Vui lòng liên hệ quản trị IT.',
      );
    }

    let activation: {
      finalStatus: 'Chờ duyệt' | 'Đã duyệt';
      activatedStepOrder: number | null;
      skippedStepOrders: number[];
    } = { finalStatus: 'Chờ duyệt', activatedStepOrder: 1, skippedStepOrders: [] };

    const result = await this.prisma.$transaction(async (tx) => {
      // Clear any prior steps (e.g. if resubmitted after return)
      await tx.documentApprovalStep.deleteMany({ where: { documentId } });

      // Create snapshot of steps (chưa kích hoạt bước nào — activateNextEligibleStep
      // sẽ tự tìm bước đầu tiên thực sự có người xử lý được, bỏ qua các bước
      // Trưởng Ban không áp dụng cho hồ sơ không thuộc dự án nào).
      const createdSteps: Array<{ id: number; stepOrder: number; roleRequired: string }> = [];
      for (const stepTpl of workflowTemplate.steps) {
        const created = await tx.documentApprovalStep.create({
          data: {
            documentId,
            stepOrder: stepTpl.stepOrder,
            roleRequired: stepTpl.roleRequired,
            status: 'not_started',
          },
        });
        createdSteps.push(created);
      }

      activation = await this.activateNextEligibleStep(tx, doc, createdSteps, 1);

      const updated = await tx.document.update({
        where: { id: documentId },
        data: {
          status: activation.finalStatus,
          version: doc.version + 1,
        },
        include: {
          steps: { orderBy: { stepOrder: 'asc' } },
          createdBy: {
            select: { id: true, name: true, email: true, departmentId: true },
          },
        },
      });

      await this.auditService.logEvent({
        entityType: 'Document',
        entityId: doc.id,
        action: 'submit_approval',
        actorId: userId,
        beforeJson: { status: 'Nháp' },
        afterJson: {
          status: activation.finalStatus,
          stepsCount: workflowTemplate.steps.length,
          skippedStepOrders: activation.skippedStepOrders,
        },
        ip,
      });

      return updated;
    });

    // Bắn thông báo tức thời cho người duyệt bước thực sự được kích hoạt
    // (có thể không phải bước 1 nếu Trưởng Ban bị tự động bỏ qua).
    if (activation.activatedStepOrder !== null) {
      const activatedTpl = workflowTemplate.steps.find(
        (s) => s.stepOrder === activation.activatedStepOrder,
      );
      if (activatedTpl) {
        await this.notifyStepApprovers(
          result,
          activatedTpl.stepOrder,
          activatedTpl.roleRequired,
        );
      }
    }

    return result;
  }

  async approveStep(
    documentId: number,
    stepId: number,
    user: any,
    dto?: ActionStepDto,
    currentVersion?: number,
    ip?: string,
  ) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
        createdBy: {
          select: { id: true, name: true, email: true, departmentId: true },
        },
      },
    });

    if (!doc) {
      throw new NotFoundException('Không tìm thấy hồ sơ');
    }

    if (doc.status !== 'Chờ duyệt') {
      throw new BadRequestException('Hồ sơ không ở trạng thái Chờ duyệt');
    }

    // Optimistic locking check
    if (currentVersion !== undefined && doc.version !== currentVersion) {
      throw new ConflictException(
        'Hồ sơ đã được phê duyệt hoặc cập nhật bởi người khác. Vui lòng tải lại.',
      );
    }

    const step = doc.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new NotFoundException('Không tìm thấy bước duyệt trong hồ sơ');
    }

    if (step.status !== 'pending') {
      throw new BadRequestException(
        'Bước này hiện không ở trạng thái chờ duyệt',
      );
    }

    // Anti self-approval rule
    if (doc.createdById === user.id) {
      throw new ForbiddenException(
        'Quy định kiểm soát nội bộ: Người tạo hồ sơ không được phép tự phê duyệt hồ sơ của chính mình',
      );
    }

    const approvalDelegator = this.resolveApprovalDelegator(
      doc,
      user,
      step.roleRequired,
    );

    // Bắt buộc mã PIN xác nhận duyệt cho bước phê duyệt CUỐI CÙNG do CEO thực
    // hiện — xác định động theo cấu hình luồng hiện tại (stepOrder lớn nhất),
    // không hardcode, để đúng ngay cả khi IT admin đổi lại số cấp duyệt sau này.
    const maxStepOrder = Math.max(...doc.steps.map((s) => s.stepOrder));
    const isFinalAccountantStep =
      doc.type === 'payment_request' &&
      step.roleRequired === 'accountant' &&
      step.stepOrder === maxStepOrder;
    if (isFinalAccountantStep) {
      const proofCount = await this.prisma.attachment.count({
        where: {
          entityType: 'document',
          entityId: documentId,
          uploadedById: user.id,
        },
      });
      if (proofCount === 0) {
        throw new BadRequestException(
          'Bắt buộc đính kèm chứng từ giao dịch trước khi Kế toán duyệt bước cuối.',
        );
      }
    }
    const isFinalCeoStep =
      step.roleRequired === 'ceo' && step.stepOrder === maxStepOrder;
    if (isFinalCeoStep) {
      // CEO có thể tự bật/tắt yêu cầu PIN — chỉ bắt buộc khi đang bật.
      const pinRequired = await this.authService.isApprovalPinEnabled(user.id);
      if (pinRequired) {
        if (!dto?.pin) {
          throw new BadRequestException(
            'Đây là bước phê duyệt cuối cùng — bắt buộc nhập mã PIN xác nhận duyệt (6 số).',
          );
        }
        await this.authService.verifyApprovalPin(user.id, dto.pin);
      }
    }

    let activation: {
      finalStatus: 'Chờ duyệt' | 'Đã duyệt';
      activatedStepOrder: number | null;
      skippedStepOrders: number[];
    } = { finalStatus: 'Đã duyệt', activatedStepOrder: null, skippedStepOrders: [] };

    const result = await this.prisma.$transaction(async (tx) => {
      // Approve current step
      await tx.documentApprovalStep.update({
        where: { id: step.id },
        data: {
          status: 'approved',
          actedById: user.id,
          actedAt: new Date(),
          comment: dto?.comment || null,
        },
      });

      // Kích hoạt bước kế tiếp — tự động bỏ qua các bước Trưởng Ban không
      // có ai đủ điều kiện xử lý (hồ sơ không thuộc dự án nào).
      activation = await this.activateNextEligibleStep(
        tx,
        doc,
        doc.steps,
        step.stepOrder + 1,
      );
      const newDocumentStatus = activation.finalStatus;

      const updatedDoc = await tx.document.update({
        where: { id: documentId },
        data: {
          status: newDocumentStatus,
          version: doc.version + 1,
        },
        include: {
          steps: { orderBy: { stepOrder: 'asc' } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      const isFinalDocApproval = newDocumentStatus === 'Đã duyệt';
      await this.auditService.logEvent({
        entityType: 'Document',
        entityId: doc.id,
        action: isFinalDocApproval ? 'approve_document_final' : 'approve_step',
        actorId: user.id,
        beforeJson: {
          stepOrder: step.stepOrder,
          roleRequired: step.roleRequired,
        },
        afterJson: {
          status: newDocumentStatus,
          approvedStep: step.stepOrder,
          comment: dto?.comment || null,
          actedOnBehalfOf: approvalDelegator?.id || null,
          actedOnBehalfOfName: approvalDelegator?.name || null,
          skippedStepOrders: activation.skippedStepOrders,
        },
        ip,
      });

      return updatedDoc;
    });

    // Bắn thông báo tức thời cho bước thực sự được kích hoạt hoặc người tạo
    // hồ sơ (nếu đã duyệt xong toàn bộ, kể cả khi các bước cuối bị bỏ qua).
    if (activation.activatedStepOrder !== null) {
      const activatedStep = doc.steps.find(
        (s) => s.stepOrder === activation.activatedStepOrder,
      );
      if (activatedStep) {
        await this.notifyStepApprovers(
          result,
          activatedStep.stepOrder,
          activatedStep.roleRequired,
        );
      }
    } else {
      // Đã duyệt xong bước cuối
      await this.notificationsService.dispatchNotification({
        userId: doc.createdById,
        eventType: 'document_approved',
        entityRef: `document:${doc.id}`,
        title: `Hồ sơ đã được phê duyệt: ${doc.code}`,
        content: `Hồ sơ "${doc.title}" của bạn đã hoàn tất quy trình phê duyệt.`,
        link: `/documents?id=${doc.id}`,
        dedupeKey: `doc_approved_${doc.id}_${Date.now()}`,
      });
    }

    return result;
  }

  async approveDirect(
    documentId: number,
    user: any,
    dto?: ActionStepDto,
    currentVersion?: number,
    ip?: string,
  ) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!doc) throw new NotFoundException('Không tìm thấy hồ sơ');
    if (doc.type === 'payment_request') {
      throw new BadRequestException(
        'Đề nghị thanh toán phải được CEO rà soát rồi chuyển Kế toán xử lý chi tiền; không được duyệt thẳng toàn bộ quy trình.',
      );
    }
    if (doc.status !== 'Chờ duyệt') {
      throw new BadRequestException('Hồ sơ không ở trạng thái Chờ duyệt');
    }
    if (currentVersion !== undefined && doc.version !== currentVersion) {
      throw new ConflictException(
        'Hồ sơ đã được cập nhật bởi người khác. Vui lòng tải lại.',
      );
    }
    if (doc.createdById === user.id) {
      throw new ForbiddenException(
        'Quy định kiểm soát nội bộ: CEO không được tự phê duyệt hồ sơ do chính mình tạo',
      );
    }

    if (!getEffectiveRoleNames(user).includes('ceo')) {
      throw new ForbiddenException('Chỉ CEO mới có quyền duyệt thẳng hồ sơ');
    }
    const approvalDelegator = this.resolveApprovalDelegator(doc, user, 'ceo');

    const pinRequired = await this.authService.isApprovalPinEnabled(user.id);
    if (pinRequired) {
      if (!dto?.pin) {
        throw new BadRequestException(
          'Vui lòng nhập mã PIN 6 số để xác nhận duyệt thẳng hồ sơ.',
        );
      }
      await this.authService.verifyApprovalPin(user.id, dto.pin);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.documentApprovalStep.updateMany({
        where: { documentId, status: { not: 'approved' } },
        data: {
          status: 'approved',
          actedById: user.id,
          actedAt: new Date(),
          comment: dto?.comment || 'CEO duyệt thẳng toàn bộ quy trình',
        },
      });

      const newStatus = 'Đã duyệt';
      const updatedDoc = await tx.document.update({
        where: { id: documentId },
        data: { status: newStatus, version: doc.version + 1 },
        include: {
          steps: { orderBy: { stepOrder: 'asc' } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      await this.auditService.logEvent({
        entityType: 'Document',
        entityId: doc.id,
        action: 'approve_document_direct',
        actorId: user.id,
        beforeJson: {
          status: doc.status,
          remainingSteps: doc.steps.filter((s: any) => s.status !== 'approved')
            .length,
        },
        afterJson: {
          status: newStatus,
          comment: dto?.comment || 'CEO duyệt thẳng toàn bộ quy trình',
          actedOnBehalfOf: approvalDelegator?.id || null,
          actedOnBehalfOfName: approvalDelegator?.name || null,
        },
        ip,
      });

      return updatedDoc;
    });

    await this.notificationsService.dispatchNotification({
      userId: doc.createdById,
      eventType: 'document_approved',
      entityRef: `document:${doc.id}`,
      title: `CEO đã duyệt thẳng hồ sơ: ${doc.code}`,
      content: `Hồ sơ "${doc.title}" đã được CEO phê duyệt hoàn tất.`,
      link: `/documents?id=${doc.id}`,
      dedupeKey: `doc_direct_approved_${doc.id}_${Date.now()}`,
    });

    return result;
  }

  async returnStep(
    documentId: number,
    stepId: number,
    user: any,
    dto: RejectOrReturnStepDto,
    currentVersion?: number,
    ip?: string,
  ) {
    if (!dto.comment || !dto.comment.trim()) {
      throw new BadRequestException(
        'Bắt buộc phải nhập lý do khi trả lại hồ sơ',
      );
    }

    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
        createdBy: {
          select: { id: true, name: true, email: true, departmentId: true },
        },
      },
    });

    if (!doc) {
      throw new NotFoundException('Không tìm thấy hồ sơ');
    }

    if (doc.status !== 'Chờ duyệt') {
      throw new BadRequestException('Hồ sơ không ở trạng thái Chờ duyệt');
    }

    if (currentVersion !== undefined && doc.version !== currentVersion) {
      throw new ConflictException(
        'Hồ sơ đã được cập nhật từ phiên khác. Vui lòng tải lại trang.',
      );
    }

    const step = doc.steps.find((s) => s.id === stepId);
    if (!step || step.status !== 'pending') {
      throw new BadRequestException(
        'Bước này không hợp lệ hoặc không ở trạng thái chờ duyệt',
      );
    }

    if (doc.createdById === user.id) {
      throw new ForbiddenException(
        'Người tạo không được thao tác trên bước phê duyệt của mình',
      );
    }

    const approvalDelegator = this.resolveApprovalDelegator(
      doc,
      user,
      step.roleRequired,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      // Mark step as returned
      await tx.documentApprovalStep.update({
        where: { id: step.id },
        data: {
          status: 'returned',
          actedById: user.id,
          actedAt: new Date(),
          comment: dto.comment,
        },
      });

      // Per architecture specs: Return resets document back to 'Nháp' for creator to modify and restart
      const updatedDoc = await tx.document.update({
        where: { id: documentId },
        data: {
          status: 'Nháp',
          version: doc.version + 1,
        },
        include: {
          steps: { orderBy: { stepOrder: 'asc' } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      await this.auditService.logEvent({
        entityType: 'Document',
        entityId: doc.id,
        action: 'return_document',
        actorId: user.id,
        beforeJson: { status: 'Chờ duyệt', stepOrder: step.stepOrder },
        afterJson: {
          status: 'Nháp',
          reason: dto.comment,
          actedOnBehalfOf: approvalDelegator?.id || null,
          actedOnBehalfOfName: approvalDelegator?.name || null,
        },
        ip,
      });

      return updatedDoc;
    });

    // Bắn thông báo tức thời cho người tạo hồ sơ
    await this.notificationsService.dispatchNotification({
      userId: doc.createdById,
      eventType: 'document_returned',
      entityRef: `document:${doc.id}`,
      title: `Hồ sơ bị trả lại: ${doc.code}`,
      content: `Hồ sơ "${doc.title}" của bạn đã bị trả lại. Lý do: ${dto.comment}`,
      link: `/documents?id=${doc.id}`,
      dedupeKey: `doc_returned_${doc.id}_${Date.now()}`,
    });

    return result;
  }

  async rejectStep(
    documentId: number,
    stepId: number,
    user: any,
    dto: RejectOrReturnStepDto,
    currentVersion?: number,
    ip?: string,
  ) {
    if (!dto.comment || !dto.comment.trim()) {
      throw new BadRequestException(
        'Bắt buộc phải nhập lý do khi từ chối hồ sơ',
      );
    }

    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
        createdBy: {
          select: { id: true, name: true, email: true, departmentId: true },
        },
      },
    });

    if (!doc) {
      throw new NotFoundException('Không tìm thấy hồ sơ');
    }

    if (doc.status !== 'Chờ duyệt') {
      throw new BadRequestException('Hồ sơ không ở trạng thái Chờ duyệt');
    }

    if (currentVersion !== undefined && doc.version !== currentVersion) {
      throw new ConflictException(
        'Hồ sơ đã được cập nhật từ phiên khác. Vui lòng tải lại trang.',
      );
    }

    const step = doc.steps.find((s) => s.id === stepId);
    if (!step || step.status !== 'pending') {
      throw new BadRequestException(
        'Bước này không hợp lệ hoặc không ở trạng thái chờ duyệt',
      );
    }

    if (doc.createdById === user.id) {
      throw new ForbiddenException(
        'Người tạo không được thao tác trên bước phê duyệt của mình',
      );
    }

    const approvalDelegator = this.resolveApprovalDelegator(
      doc,
      user,
      step.roleRequired,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      // Mark step as rejected
      await tx.documentApprovalStep.update({
        where: { id: step.id },
        data: {
          status: 'rejected',
          actedById: user.id,
          actedAt: new Date(),
          comment: dto.comment,
        },
      });

      // Terminal status: 'Từ chối'
      const updatedDoc = await tx.document.update({
        where: { id: documentId },
        data: {
          status: 'Từ chối',
          version: doc.version + 1,
        },
        include: {
          steps: { orderBy: { stepOrder: 'asc' } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      await this.auditService.logEvent({
        entityType: 'Document',
        entityId: doc.id,
        action: 'reject_document',
        actorId: user.id,
        beforeJson: { status: 'Chờ duyệt', stepOrder: step.stepOrder },
        afterJson: {
          status: 'Từ chối',
          reason: dto.comment,
          actedOnBehalfOf: approvalDelegator?.id || null,
          actedOnBehalfOfName: approvalDelegator?.name || null,
        },
        ip,
      });

      return updatedDoc;
    });

    // Bắn thông báo tức thời cho người tạo hồ sơ
    await this.notificationsService.dispatchNotification({
      userId: doc.createdById,
      eventType: 'document_rejected',
      entityRef: `document:${doc.id}`,
      title: `Hồ sơ bị từ chối: ${doc.code}`,
      content: `Hồ sơ "${doc.title}" của bạn đã bị từ chối. Lý do: ${dto.comment}`,
      link: `/documents?id=${doc.id}`,
      dedupeKey: `doc_rejected_${doc.id}_${Date.now()}`,
    });

    return result;
  }

  async findAll(
    user: any,
    query: { status?: string; type?: string; tab?: string; projectId?: number },
  ) {
    const where: any = {};
    const accessScope = buildDocumentAccessWhere(user);

    if (query.type) {
      where.type = query.type;
    }

    if (query.status && query.status !== 'all') {
      where.status = query.status;
    }
    if (query.projectId) {
      where.OR = [
        { projectId: query.projectId },
        { linkedProjectIds: { array_contains: [query.projectId] } },
      ];
    }

    if (query.tab === 'my') {
      where.AND = [accessScope, { createdById: user.id }];
    } else if (query.tab === 'to_review') {
      const conditions = buildApprovalStepAccessConditions(user);

      where.AND = [
        accessScope,
        { status: 'Chờ duyệt' },
        { createdById: { not: user.id } },
        conditions.length > 0
          ? {
              steps: {
                some:
                  conditions.length === 1 ? conditions[0] : { OR: conditions },
              },
            }
          : { id: -1 },
      ];
    } else {
      where.AND = [accessScope];
    }

    const docs = await this.prisma.document.findMany({
      relationLoadStrategy: 'join',
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, department: true },
        },
        targetUser: {
          select: { id: true, name: true, email: true, department: true },
        },
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
        project: true,
      },
    });

    return docs.map((doc) => this.enrichDocument(doc));
  }

  async findById(user: any, id: number) {
    const doc = await this.prisma.document.findFirst({
      relationLoadStrategy: 'join',
      where: { AND: [{ id }, buildDocumentAccessWhere(user)] },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, department: true },
        },
        targetUser: {
          select: { id: true, name: true, email: true, department: true },
        },
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
        project: true,
      },
    });

    if (!doc) {
      throw new NotFoundException('Không tìm thấy hồ sơ');
    }

    const attachments = await this.prisma.attachment.findMany({
      where: { entityId: id, entityType: 'document' },
      orderBy: { uploadedAt: 'desc' },
    });
    const relatedUserIds = [
      ...new Set([
        ...attachments.map((attachment) => attachment.uploadedById),
        ...(doc.steps || [])
          .map((step: any) => step.actedById)
          .filter((userId: number | null): userId is number => Boolean(userId)),
      ]),
    ];
    const relatedUsers = relatedUserIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: relatedUserIds } },
          select: {
            id: true,
            name: true,
            email: true,
            roles: { select: { name: true } },
          },
        })
      : [];
    const userById = new Map(
      relatedUsers.map((relatedUser) => [relatedUser.id, relatedUser]),
    );

    return this.enrichDocument({
      ...doc,
      steps: (doc.steps || []).map((step: any) => ({
        ...step,
        actedBy: step.actedById
          ? userById.get(step.actedById) || null
          : null,
      })),
      attachments: attachments.map((attachment) => ({
        ...attachment,
        uploadedBy: userById.get(attachment.uploadedById) || null,
      })),
    });
  }

  async getExpiringContracts(user: any, offsetDays: number = 30) {
    const contracts = await this.findAll(user, { type: 'contract' });
    return contracts.filter((c: any) => {
      const expiry = this.calculateContractExpiry(c.dataJson, offsetDays);
      return (
        expiry.expiringStatus === 'expiring_soon' ||
        expiry.expiringStatus === 'expired'
      );
    });
  }
}
