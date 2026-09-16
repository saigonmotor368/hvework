import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReportFilterDto } from './dto/report-filter.dto.js';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // Check if user has CEO or IT Admin role
  isCeoOrAdmin(user: any): boolean {
    const roles: string[] = user.roles ? user.roles.map((r: any) => (typeof r === 'string' ? r : r.name)) : [];
    return roles.includes('ceo') || roles.includes('it_admin');
  }

  async getSummary(user: any, filter: ReportFilterDto) {
    const roles: string[] = user.roles ? user.roles.map((r: any) => (typeof r === 'string' ? r : r.name)) : [];
    const isCompanyWide = roles.some((r) => ['ceo', 'it_admin', 'accountant', 'legal'].includes(r));
    const isDeptHead = roles.includes('department_head');
    const isEmployeeOnly = !isCompanyWide && !isDeptHead;
    const userDeptId = user.departmentId || user.department?.id;

    // 1. Filter conditions for Documents with Role-Based Scoping
    const docWhere: any = {};
    if (filter.startDate || filter.endDate) {
      docWhere.createdAt = {};
      if (filter.startDate) docWhere.createdAt.gte = new Date(filter.startDate);
      if (filter.endDate) {
        const end = new Date(filter.endDate);
        end.setHours(23, 59, 59, 999);
        docWhere.createdAt.lte = end;
      }
    }
    if (filter.type) {
      docWhere.type = filter.type;
    }
    if (filter.status && filter.status !== 'all') {
      docWhere.status = filter.status;
    }

    // Role scoping for Documents
    if (isEmployeeOnly) {
      // Nhân viên chỉ được xem hồ sơ do chính mình tạo, không xem được phòng khác
      docWhere.createdById = user.id;
    } else if (isDeptHead && userDeptId) {
      // Trưởng bộ phận chỉ được xem hồ sơ của nhân sự thuộc bộ phận mình phụ trách
      docWhere.createdBy = { departmentId: userDeptId };
      if (filter.userId) {
        docWhere.createdById = Number(filter.userId);
      }
    } else {
      // Vai trò toàn công ty (CEO, IT Admin, Kế toán, Pháp chế)
      if (filter.userId) {
        docWhere.createdById = Number(filter.userId);
      }
      if (filter.departmentId) {
        docWhere.createdBy = { departmentId: Number(filter.departmentId) };
      }
    }

    const documents = await this.prisma.document.findMany({
      where: docWhere,
      include: {
        createdBy: { select: { id: true, name: true, email: true, departmentId: true, department: { select: { id: true, name: true } } } },
        steps: { orderBy: { stepOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const docTotal = documents.length;
    const docApproved = documents.filter((d: any) => d.status === 'Đã duyệt').length;
    const docPending = documents.filter((d: any) => d.status === 'Chờ duyệt').length;
    const docRejected = documents.filter((d: any) => d.status === 'Từ chối' || d.status === 'Trả lại').length;
    const docDraft = documents.filter((d: any) => d.status === 'Nháp').length;

    // Document types breakdown
    const docTypeMap: Record<string, number> = {};
    for (const d of documents as any[]) {
      docTypeMap[d.type] = (docTypeMap[d.type] || 0) + 1;
    }

    // Average approval time for completed documents (hours)
    let totalApprovalHours = 0;
    let approvedCountWithSteps = 0;
    for (const d of documents as any[]) {
      if (d.status === 'Đã duyệt' && d.steps.length > 0) {
        const lastStep = d.steps[d.steps.length - 1];
        if (lastStep.actedAt) {
          const diffMs = lastStep.actedAt.getTime() - d.createdAt.getTime();
          totalApprovalHours += diffMs / (1000 * 60 * 60);
          approvedCountWithSteps++;
        }
      }
    }
    const avgApprovalTimeHours = approvedCountWithSteps > 0
      ? Math.round((totalApprovalHours / approvedCountWithSteps) * 10) / 10
      : 0;

    // 2. Filter conditions for Tasks with Role-Based Scoping
    const taskWhere: any = {};
    if (filter.startDate || filter.endDate) {
      taskWhere.createdAt = {};
      if (filter.startDate) taskWhere.createdAt.gte = new Date(filter.startDate);
      if (filter.endDate) {
        const end = new Date(filter.endDate);
        end.setHours(23, 59, 59, 999);
        taskWhere.createdAt.lte = end;
      }
    }
    if (filter.status && filter.status !== 'all') {
      taskWhere.status = filter.status;
    }

    // Role scoping for Tasks
    if (isEmployeeOnly) {
      // Nhân viên chỉ xem các công việc mình được giao hoặc do mình tạo
      taskWhere.OR = [
        { assigneeId: user.id },
        { createdById: user.id },
      ];
    } else if (isDeptHead && userDeptId) {
      // Trưởng bộ phận chỉ xem công việc của nhân sự trong phòng ban mình
      taskWhere.OR = [
        { assignee: { departmentId: userDeptId } },
        { createdBy: { departmentId: userDeptId } },
      ];
      if (filter.userId) {
        taskWhere.assigneeId = Number(filter.userId);
      }
    } else {
      // Toàn quyền
      if (filter.userId) {
        taskWhere.assigneeId = Number(filter.userId);
      }
      if (filter.departmentId) {
        taskWhere.assignee = { departmentId: Number(filter.departmentId) };
      }
    }

    const tasks = await this.prisma.task.findMany({
      where: taskWhere,
      include: {
        assignee: { select: { id: true, name: true, department: { select: { id: true, name: true } } } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const taskTotal = tasks.length;
    const taskCompleted = tasks.filter((t: any) => t.status === 'Hoàn thành').length;
    const taskInProgress = tasks.filter((t: any) => t.status === 'Đang làm').length;
    const taskPendingReview = tasks.filter((t: any) => t.status === 'Chờ duyệt').length;
    const taskNotStarted = tasks.filter((t: any) => t.status === 'Chưa làm').length;
    const taskOverdue = tasks.filter(
      (t: any) => t.status !== 'Hoàn thành' && t.dueDate && new Date(t.dueDate) < now,
    ).length;

    // 3. Contracts metrics with Role-Based Scoping
    // Nhân viên bình thường không có quyền xem danh mục hợp đồng công ty
    const contracts = isEmployeeOnly ? [] : documents.filter((d: any) => d.type === 'contract');
    let totalContractValue = 0;
    let expiringSoonCount = 0;
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const contractList = contracts.map((c: any) => {
      const data = (c.dataJson as any) || {};
      const val = Number(data.value) || 0;
      totalContractValue += val;

      let isExpiringSoon = false;
      if (data.endDate) {
        const end = new Date(data.endDate);
        if (end >= now && end <= in30Days) {
          isExpiringSoon = true;
          expiringSoonCount++;
        }
      }

      return {
        id: c.id,
        code: c.code,
        title: c.title,
        partner: data.partner || 'N/A',
        value: val,
        startDate: data.startDate,
        endDate: data.endDate,
        manager: data.manager || 'N/A',
        status: c.status,
        isExpiringSoon,
      };
    });

    return {
      filtersApplied: filter,
      documents: {
        total: docTotal,
        approved: docApproved,
        pending: docPending,
        rejected: docRejected,
        draft: docDraft,
        approvalRate: docTotal > 0 ? Math.round((docApproved / docTotal) * 100) : 0,
        avgApprovalTimeHours,
        byType: docTypeMap,
        items: documents.slice(0, 100).map((d: any) => ({
          id: d.id,
          code: d.code,
          title: d.title,
          type: d.type,
          status: d.status,
          creator: d.createdBy.name,
          department: d.createdBy.department?.name || 'N/A',
          createdAt: d.createdAt,
        })),
      },
      tasks: {
        total: taskTotal,
        completed: taskCompleted,
        inProgress: taskInProgress,
        pendingReview: taskPendingReview,
        notStarted: taskNotStarted,
        overdue: taskOverdue,
        completionRate: taskTotal > 0 ? Math.round((taskCompleted / taskTotal) * 100) : 0,
        items: tasks.slice(0, 100).map((t: any) => ({
          id: t.id,
          code: t.code,
          title: t.title,
          priority: t.priority,
          status: t.status,
          progressPercent: t.progressPercent,
          assignee: t.assignee?.name || 'Chưa phân công',
          department: t.assignee?.department?.name || 'N/A',
          dueDate: t.dueDate,
          isOverdue: t.status !== 'Hoàn thành' && t.dueDate ? new Date(t.dueDate) < now : false,
        })),
      },
      contracts: {
        total: contracts.length,
        totalValue: totalContractValue,
        expiringSoonCount,
        items: contractList,
      },
    };
  }

  async getAuditLogs(user: any, filter: { startDate?: string; endDate?: string; entityType?: string; limit?: number }) {
    if (!this.isCeoOrAdmin(user)) {
      throw new ForbiddenException('Chỉ CEO và Quản trị IT mới có quyền xem và truy xuất Nhật ký hệ thống.');
    }

    const where: any = {};
    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) where.createdAt.gte = new Date(filter.startDate);
      if (filter.endDate) {
        const end = new Date(filter.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }
    if (filter.entityType) {
      where.entityType = filter.entityType;
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filter.limit || 200,
    });

    // Populate actor names
    const actorIds = Array.from(new Set(logs.map((l: any) => l.actorId).filter(Boolean))) as number[];
    const actors = await this.prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, name: true, email: true },
    });
    const actorMap = new Map(actors.map((a: any) => [a.id, a]));

    return logs.map((l: any) => ({
      ...l,
      actor: l.actorId ? actorMap.get(l.actorId) || { name: 'Người dùng #' + l.actorId } : { name: 'Hệ thống' },
    }));
  }

  async exportCsv(user: any, type: string, filter: ReportFilterDto): Promise<string> {
    const roles: string[] = user.roles ? user.roles.map((r: any) => (typeof r === 'string' ? r : r.name)) : [];
    const isCompanyWide = roles.some((r) => ['ceo', 'it_admin', 'accountant', 'legal'].includes(r));
    const isDeptHead = roles.includes('department_head');
    const isEmployeeOnly = !isCompanyWide && !isDeptHead;

    if (type === 'audit_logs' && !this.isCeoOrAdmin(user)) {
      throw new ForbiddenException('Chỉ CEO và Quản trị IT mới có quyền xuất Nhật ký hệ thống.');
    }

    if (type === 'contracts' && isEmployeeOnly) {
      throw new ForbiddenException('Nhân viên không có quyền truy xuất danh mục hợp đồng của công ty.');
    }

    // CSV BOM UTF-8 (\uFEFF) to ensure Microsoft Excel on Windows parses Vietnamese characters cleanly
    const BOM = '\uFEFF';
    let csvContent = '';

    if (type === 'documents') {
      const summary = await this.getSummary(user, filter);
      const headers = ['Mã hồ sơ', 'Tiêu đề', 'Loại hồ sơ', 'Trạng thái', 'Người tạo', 'Phòng ban', 'Ngày tạo'];
      const rows = summary.documents.items.map((d: any) => [
        this.escapeCsv(d.code),
        this.escapeCsv(d.title),
        this.escapeCsv(this.mapDocType(d.type)),
        this.escapeCsv(d.status),
        this.escapeCsv(d.creator),
        this.escapeCsv(d.department),
        this.escapeCsv(new Date(d.createdAt).toLocaleDateString('vi-VN')),
      ]);
      csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\r\n');
    } else if (type === 'tasks') {
      const summary = await this.getSummary(user, filter);
      const headers = ['Mã công việc', 'Tiêu đề', 'Mức ưu tiên', 'Trạng thái', 'Tiến độ (%)', 'Người thực hiện', 'Phòng ban', 'Hạn hoàn thành', 'Quá hạn'];
      const rows = summary.tasks.items.map((t: any) => [
        this.escapeCsv(t.code),
        this.escapeCsv(t.title),
        this.escapeCsv(t.priority),
        this.escapeCsv(t.status),
        t.progressPercent,
        this.escapeCsv(t.assignee),
        this.escapeCsv(t.department),
        this.escapeCsv(t.dueDate ? new Date(t.dueDate).toLocaleDateString('vi-VN') : ''),
        t.isOverdue ? 'Có' : 'Không',
      ]);
      csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\r\n');
    } else if (type === 'contracts') {
      const summary = await this.getSummary(user, filter);
      const headers = ['Mã hợp đồng', 'Tiêu đề', 'Đối tác', 'Giá trị (VNĐ)', 'Ngày hiệu lực', 'Ngày hết hạn', 'Người phụ trách', 'Trạng thái', 'Sắp hết hạn'];
      const rows = summary.contracts.items.map((c: any) => [
        this.escapeCsv(c.code),
        this.escapeCsv(c.title),
        this.escapeCsv(c.partner),
        c.value,
        this.escapeCsv(c.startDate ? new Date(c.startDate).toLocaleDateString('vi-VN') : ''),
        this.escapeCsv(c.endDate ? new Date(c.endDate).toLocaleDateString('vi-VN') : ''),
        this.escapeCsv(c.manager),
        this.escapeCsv(c.status),
        c.isExpiringSoon ? 'Có' : 'Không',
      ]);
      csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\r\n');
    } else if (type === 'audit_logs') {
      const logs = await this.getAuditLogs(user, {
        startDate: filter.startDate,
        endDate: filter.endDate,
        limit: 1000,
      });
      const headers = ['ID', 'Đối tượng', 'Mã bản ghi', 'Hành động', 'Người thao tác', 'Địa chỉ IP', 'Thời gian'];
      const rows = logs.map((l: any) => [
        l.id,
        this.escapeCsv(l.entityType),
        l.entityId || '',
        this.escapeCsv(l.action),
        this.escapeCsv(l.actor?.name || 'Hệ thống'),
        this.escapeCsv(l.ip || ''),
        this.escapeCsv(new Date(l.createdAt).toLocaleString('vi-VN')),
      ]);
      csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\r\n');
    }

    return BOM + csvContent;
  }

  private escapeCsv(field: any): string {
    if (field === null || field === undefined) return '""';
    const str = String(field).replace(/"/g, '""');
    return `"${str}"`;
  }

  private mapDocType(type: string): string {
    switch (type) {
      case 'payment_request':
        return 'Đề nghị thanh toán';
      case 'proposal':
        return 'Đề xuất / Tờ trình';
      case 'contract':
        return 'Hợp đồng';
      default:
        return type;
    }
  }
}
