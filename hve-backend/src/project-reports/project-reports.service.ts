import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { getRoleNames, getUserProjectIds } from '../common/access-scope.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ReviewProjectReportDto,
  UpsertProjectReportDto,
} from './dto/project-report.dto.js';

const reportInclude = {
  author: { select: { id: true, name: true, email: true } },
  project: {
    select: {
      id: true,
      code: true,
      name: true,
      location: true,
      leadUserId: true,
    },
  },
  viewers: {
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: 'asc' as const } },
  },
  reviewedBy: { select: { id: true, name: true, email: true } },
} as const;

@Injectable()
export class ProjectReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private isBoard(user: any) {
    return getRoleNames(user).some((role) => ['ceo', 'bgd'].includes(role));
  }

  private visibleWhere(user: any) {
    if (this.isBoard(user)) {
      return { OR: [{ authorId: user.id }, { status: { not: 'draft' } }] };
    }
    return {
      OR: [
        { authorId: user.id },
        {
          AND: [
            { status: { not: 'draft' } },
            {
              OR: [
                { viewers: { some: { userId: user.id } } },
                { project: { leadUserId: user.id } },
              ],
            },
          ],
        },
      ],
    };
  }

  private async attachFiles<T extends { id: number }>(reports: T[]) {
    if (reports.length === 0)
      return reports.map((report) => ({ ...report, attachments: [] }));
    const attachments = await this.prisma.attachment.findMany({
      where: {
        entityType: 'report',
        entityId: { in: reports.map((report) => report.id) },
      },
      orderBy: { uploadedAt: 'desc' },
    });
    const byReport = new Map<number, any[]>();
    attachments.forEach((attachment) => {
      const list = byReport.get(attachment.entityId) || [];
      list.push(attachment);
      byReport.set(attachment.entityId, list);
    });
    return reports.map((report) => ({
      ...report,
      attachments: byReport.get(report.id) || [],
    }));
  }

  private permissions(user: any, report: any) {
    const isAuthor = report.authorId === user.id;
    const editable = isAuthor && ['draft', 'rejected'].includes(report.status);
    return {
      canEdit: editable,
      canDelete: editable,
      canSubmit: editable,
      canReview: !isAuthor && report.status === 'submitted',
    };
  }

  private present(user: any, report: any) {
    return { ...report, permissions: this.permissions(user, report) };
  }

  async findAll(
    user: any,
    filter: { status?: string; projectId?: number; search?: string },
  ) {
    const conditions: any[] = [this.visibleWhere(user)];
    if (filter.status && filter.status !== 'all')
      conditions.push({ status: filter.status });
    if (filter.projectId) conditions.push({ projectId: filter.projectId });
    if (filter.search?.trim()) {
      conditions.push({
        OR: [
          { code: { contains: filter.search.trim(), mode: 'insensitive' } },
          { title: { contains: filter.search.trim(), mode: 'insensitive' } },
          { content: { contains: filter.search.trim(), mode: 'insensitive' } },
        ],
      });
    }
    const reports = await this.prisma.projectReport.findMany({
      where: { AND: conditions },
      include: reportInclude,
      orderBy: { updatedAt: 'desc' },
    });
    const withFiles = await this.attachFiles(reports);
    return withFiles.map((report) => this.present(user, report));
  }

  async findOne(user: any, id: number) {
    const report = await this.prisma.projectReport.findFirst({
      where: { AND: [{ id }, this.visibleWhere(user)] },
      include: reportInclude,
    });
    if (!report)
      throw new NotFoundException(
        'Không tìm thấy báo cáo hoặc bạn không có quyền xem',
      );
    const [withFiles] = await this.attachFiles([report]);
    return this.present(user, withFiles);
  }

  async getViewerOptions() {
    return this.prisma.user.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
  }

  private normalize(dto: UpsertProjectReportDto) {
    const periodStart = dto.periodStart ? new Date(dto.periodStart) : null;
    const periodEnd = dto.periodEnd ? new Date(dto.periodEnd) : null;
    if (periodStart && Number.isNaN(periodStart.getTime())) {
      throw new BadRequestException('Ngày bắt đầu kỳ báo cáo không hợp lệ');
    }
    if (periodEnd && Number.isNaN(periodEnd.getTime())) {
      throw new BadRequestException('Ngày kết thúc kỳ báo cáo không hợp lệ');
    }
    if (periodStart && periodEnd && periodEnd < periodStart) {
      throw new BadRequestException(
        'Ngày kết thúc không được trước ngày bắt đầu',
      );
    }
    return {
      title: dto.title.trim(),
      content: dto.content.trim(),
      periodStart,
      periodEnd,
      projectId: dto.projectId || null,
      viewerIds: [...new Set(dto.viewerIds || [])],
      attachmentIds: [...new Set(dto.attachmentIds || [])],
    };
  }

  private async validateReferences(
    user: any,
    data: ReturnType<ProjectReportsService['normalize']>,
  ) {
    if (
      data.projectId &&
      !this.isBoard(user) &&
      !getUserProjectIds(user).includes(data.projectId)
    ) {
      throw new ForbiddenException('Bạn không thuộc dự án đã chọn');
    }
    if (data.viewerIds.length > 0) {
      const count = await this.prisma.user.count({
        where: { id: { in: data.viewerIds }, status: 'active' },
      });
      if (count !== data.viewerIds.length) {
        throw new BadRequestException(
          'Có người xem không tồn tại hoặc đã bị khóa',
        );
      }
    }
    if (data.attachmentIds.length > 0) {
      const count = await this.prisma.attachment.count({
        where: {
          id: { in: data.attachmentIds },
          uploadedById: user.id,
          entityId: 0,
        },
      });
      if (count !== data.attachmentIds.length) {
        throw new BadRequestException(
          'Có tệp đính kèm không thuộc phiên tải lên của bạn',
        );
      }
    }
  }

  private code() {
    const now = new Date();
    const day = now.toISOString().slice(0, 10).replaceAll('-', '');
    return `BCDA-${day}-${String(now.getTime()).slice(-7)}`;
  }

  async create(user: any, dto: UpsertProjectReportDto, ip?: string) {
    const data = this.normalize(dto);
    data.viewerIds = data.viewerIds.filter((id) => id !== user.id);
    await this.validateReferences(user, data);

    const report = await this.prisma.$transaction(async (tx) => {
      const created = await tx.projectReport.create({
        data: {
          code: this.code(),
          title: data.title,
          content: data.content,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          projectId: data.projectId,
          authorId: user.id,
          viewers: { create: data.viewerIds.map((userId) => ({ userId })) },
        },
        include: reportInclude,
      });
      if (data.attachmentIds.length > 0) {
        await tx.attachment.updateMany({
          where: {
            id: { in: data.attachmentIds },
            uploadedById: user.id,
            entityId: 0,
          },
          data: { entityType: 'report', entityId: created.id },
        });
      }
      return created;
    });
    await this.audit.logEvent({
      entityType: 'ProjectReport',
      entityId: report.id,
      action: 'create_report',
      actorId: user.id,
      afterJson: {
        code: report.code,
        projectId: report.projectId,
        viewerIds: data.viewerIds,
      },
      ip,
    });
    const [withFiles] = await this.attachFiles([report]);
    return this.present(user, withFiles);
  }

  async update(
    user: any,
    id: number,
    dto: UpsertProjectReportDto,
    ip?: string,
  ) {
    const existing = await this.prisma.projectReport.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy báo cáo');
    if (
      existing.authorId !== user.id ||
      !['draft', 'rejected'].includes(existing.status)
    ) {
      throw new ForbiddenException(
        'Báo cáo đã nộp hoặc đã duyệt không thể chỉnh sửa',
      );
    }
    const data = this.normalize(dto);
    data.viewerIds = data.viewerIds.filter((viewerId) => viewerId !== user.id);
    await this.validateReferences(user, data);

    const report = await this.prisma.$transaction(async (tx) => {
      await tx.projectReportViewer.deleteMany({ where: { reportId: id } });
      const updated = await tx.projectReport.update({
        where: { id },
        data: {
          title: data.title,
          content: data.content,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          projectId: data.projectId,
          viewers: { create: data.viewerIds.map((userId) => ({ userId })) },
        },
        include: reportInclude,
      });
      if (data.attachmentIds.length > 0) {
        await tx.attachment.updateMany({
          where: {
            id: { in: data.attachmentIds },
            uploadedById: user.id,
            entityId: 0,
          },
          data: { entityType: 'report', entityId: id },
        });
      }
      return updated;
    });
    await this.audit.logEvent({
      entityType: 'ProjectReport',
      entityId: id,
      action: 'update_report',
      actorId: user.id,
      beforeJson: { title: existing.title, status: existing.status },
      afterJson: { title: report.title, viewerIds: data.viewerIds },
      ip,
    });
    const [withFiles] = await this.attachFiles([report]);
    return this.present(user, withFiles);
  }

  async remove(user: any, id: number, ip?: string) {
    const report = await this.prisma.projectReport.findUnique({
      where: { id },
    });
    if (!report) throw new NotFoundException('Không tìm thấy báo cáo');
    if (
      report.authorId !== user.id ||
      !['draft', 'rejected'].includes(report.status)
    ) {
      throw new ForbiddenException(
        'Chỉ được xóa báo cáo nháp hoặc báo cáo bị yêu cầu làm lại',
      );
    }
    await this.prisma.$transaction([
      this.prisma.attachment.deleteMany({
        where: { entityType: 'report', entityId: id },
      }),
      this.prisma.projectReport.delete({ where: { id } }),
    ]);
    await this.audit.logEvent({
      entityType: 'ProjectReport',
      entityId: id,
      action: 'delete_report',
      actorId: user.id,
      beforeJson: { code: report.code, title: report.title },
      ip,
    });
  }

  private async recipientIds(report: any) {
    const leaders = report.projectId
      ? await this.prisma.project.findUnique({
          where: { id: report.projectId },
          select: { leadUserId: true },
        })
      : null;
    const board = await this.prisma.user.findMany({
      where: {
        status: 'active',
        roles: { some: { name: { in: ['ceo', 'bgd'] } } },
      },
      select: { id: true },
    });
    return [
      ...new Set([
        ...report.viewers.map((viewer: any) => viewer.userId),
        ...(leaders?.leadUserId ? [leaders.leadUserId] : []),
        ...board.map((member) => member.id),
      ]),
    ].filter((id) => id !== report.authorId);
  }

  async submit(user: any, id: number, ip?: string) {
    const report = await this.prisma.projectReport.findUnique({
      where: { id },
      include: { viewers: true, project: { select: { name: true } } },
    });
    if (!report) throw new NotFoundException('Không tìm thấy báo cáo');
    if (
      report.authorId !== user.id ||
      !['draft', 'rejected'].includes(report.status)
    ) {
      throw new ForbiddenException('Báo cáo không ở trạng thái có thể nộp');
    }
    const wasRejected = report.status === 'rejected';
    const updated = await this.prisma.projectReport.update({
      where: { id },
      data: {
        status: 'submitted',
        submittedAt: new Date(),
        reviewedById: null,
        reviewedAt: null,
        reviewComment: null,
        ...(wasRejected ? { revision: { increment: 1 } } : {}),
      },
      include: reportInclude,
    });
    await this.audit.logEvent({
      entityType: 'ProjectReport',
      entityId: id,
      action: wasRejected ? 'resubmit_report' : 'submit_report',
      actorId: user.id,
      afterJson: { status: 'submitted', revision: updated.revision },
      ip,
    });
    const recipients = await this.recipientIds(report);
    await Promise.allSettled(
      recipients.map((userId) =>
        this.notifications.dispatchNotification(
          {
            userId,
            eventType: 'project_report_submitted',
            entityRef: `project_report:${id}`,
            title: `Báo cáo mới: ${updated.code}`,
            content: `${user.name} đã nộp báo cáo “${updated.title}”${updated.project ? ` thuộc ${updated.project.name}` : ''}.`,
            link: `/project-reports?id=${id}`,
            dedupeKey: `project_report_submitted_${id}_r${updated.revision}_${userId}`,
          },
          ['in_app'],
        ),
      ),
    );
    const [withFiles] = await this.attachFiles([updated]);
    return this.present(user, withFiles);
  }

  async review(
    user: any,
    id: number,
    dto: ReviewProjectReportDto,
    ip?: string,
  ) {
    const report = await this.prisma.projectReport.findFirst({
      where: { AND: [{ id }, this.visibleWhere(user)] },
      include: reportInclude,
    });
    if (!report)
      throw new NotFoundException(
        'Không tìm thấy báo cáo hoặc bạn không có quyền xem',
      );
    if (report.authorId === user.id)
      throw new ForbiddenException('Không được tự duyệt báo cáo của mình');
    if (report.status !== 'submitted')
      throw new BadRequestException('Báo cáo này đã được xử lý');
    const comment = dto.comment?.trim() || null;
    if (dto.action === 'reject' && !comment) {
      throw new BadRequestException('Vui lòng ghi rõ nội dung cần làm lại');
    }
    const status = dto.action === 'approve' ? 'approved' : 'rejected';
    const updated = await this.prisma.projectReport.update({
      where: { id },
      data: {
        status,
        reviewedById: user.id,
        reviewedAt: new Date(),
        reviewComment: comment,
      },
      include: reportInclude,
    });
    await this.audit.logEvent({
      entityType: 'ProjectReport',
      entityId: id,
      action: dto.action === 'approve' ? 'approve_report' : 'reject_report',
      actorId: user.id,
      beforeJson: { status: report.status },
      afterJson: { status, comment },
      ip,
    });
    await this.notifications.dispatchNotification(
      {
        userId: report.authorId,
        eventType: `project_report_${status}`,
        entityRef: `project_report:${id}`,
        title:
          status === 'approved'
            ? `Báo cáo ${report.code} đã được duyệt`
            : `Báo cáo ${report.code} cần làm lại`,
        content:
          status === 'approved'
            ? `${user.name} đã phê duyệt báo cáo “${report.title}”.`
            : `${user.name} yêu cầu làm lại báo cáo “${report.title}”: ${comment}`,
        link: `/project-reports?id=${id}`,
        dedupeKey: `project_report_${status}_${id}_r${report.revision}`,
      },
      ['in_app'],
    );
    const [withFiles] = await this.attachFiles([updated]);
    return this.present(user, withFiles);
  }
}
