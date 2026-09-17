import { ForbiddenException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReportFilterDto } from './dto/report-filter.dto.js';
import {
  buildDocumentAccessWhere,
  buildTaskAccessWhere,
  getRoleNames,
} from '../common/access-scope.js';

// Màu thương hiệu HVE dùng chung cho mọi file Excel xuất ra
const HVE_BRAND_BLUE = 'FF0A66C2';
const HVE_HEADER_TEXT = 'FFFFFFFF';
const HVE_LIGHT_ROW = 'FFF3F7FC';
const HVE_AMBER = 'FFFFF4CE';
const HVE_AMBER_TEXT = 'FF8A6D1D';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // Check if user has CEO or IT Admin role
  isCeoOrAdmin(user: any): boolean {
    const roles: string[] = user.roles ? user.roles.map((r: any) => (typeof r === 'string' ? r : r.name)) : [];
    return roles.includes('ceo') || roles.includes('it_admin');
  }

  async getSummary(user: any, filter: ReportFilterDto) {
    const roles = getRoleNames(user);
    const canFilterOrganization = roles.some((role) =>
      ['ceo', 'department_head', 'accountant', 'legal'].includes(role),
    );
    // 1. Filter conditions for Documents with Role-Based Scoping
    const docFilters: any = {};
    if (filter.startDate || filter.endDate) {
      docFilters.createdAt = {};
      if (filter.startDate) docFilters.createdAt.gte = new Date(filter.startDate);
      if (filter.endDate) {
        const end = new Date(filter.endDate);
        end.setHours(23, 59, 59, 999);
        docFilters.createdAt.lte = end;
      }
    }
    if (filter.type) {
      docFilters.type = filter.type;
    }
    if (filter.status && filter.status !== 'all') {
      docFilters.status = filter.status;
    }
    if (canFilterOrganization && filter.userId) {
      docFilters.createdById = Number(filter.userId);
    }
    if (canFilterOrganization && filter.departmentId && !roles.includes('department_head')) {
      docFilters.createdBy = { departmentId: Number(filter.departmentId) };
    }
    const docWhere = { AND: [buildDocumentAccessWhere(user), docFilters] };

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
    const taskFilters: any = {};
    if (filter.startDate || filter.endDate) {
      taskFilters.createdAt = {};
      if (filter.startDate) taskFilters.createdAt.gte = new Date(filter.startDate);
      if (filter.endDate) {
        const end = new Date(filter.endDate);
        end.setHours(23, 59, 59, 999);
        taskFilters.createdAt.lte = end;
      }
    }
    if (filter.status && filter.status !== 'all') {
      taskFilters.status = filter.status;
    }
    if (canFilterOrganization && filter.userId) {
      taskFilters.assigneeId = Number(filter.userId);
    }
    if (canFilterOrganization && filter.departmentId && !roles.includes('department_head')) {
      taskFilters.assignee = { departmentId: Number(filter.departmentId) };
    }
    const taskWhere = { AND: [buildTaskAccessWhere(user), taskFilters] };

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
    const canViewContracts = roles.some((role) =>
      ['ceo', 'department_head', 'accountant', 'legal'].includes(role),
    );
    const contracts = canViewContracts
      ? documents.filter((d: any) => d.type === 'contract')
      : [];
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

  private reportTitle(type: string): string {
    switch (type) {
      case 'documents':
        return 'BÁO CÁO TỔNG HỢP HỒ SƠ';
      case 'tasks':
        return 'BÁO CÁO TIẾN ĐỘ CÔNG VIỆC';
      case 'contracts':
        return 'BÁO CÁO TÀI CHÍNH & HỢP ĐỒNG';
      case 'audit_logs':
        return 'NHẬT KÝ HỆ THỐNG';
      default:
        return 'BÁO CÁO';
    }
  }

  // Dựng phần đầu trang chung cho mọi file Excel: tên công ty + tiêu đề báo
  // cáo + ngày xuất, chiếm 1 dòng merge full chiều rộng bảng.
  private buildSheetHeader(sheet: ExcelJS.Worksheet, title: string, columnCount: number) {
    sheet.mergeCells(1, 1, 1, columnCount);
    const brandCell = sheet.getCell(1, 1);
    brandCell.value = 'HUY VÕ EDUCATION — Hệ Thống Quản Lý Công Việc';
    brandCell.font = { bold: true, size: 12, color: { argb: HVE_HEADER_TEXT } };
    brandCell.alignment = { vertical: 'middle', horizontal: 'left' };
    brandCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HVE_BRAND_BLUE } };
    sheet.getRow(1).height = 26;

    sheet.mergeCells(2, 1, 2, columnCount);
    const titleCell = sheet.getCell(2, 1);
    titleCell.value = `${title}   —   Xuất lúc ${new Date().toLocaleString('vi-VN')}`;
    titleCell.font = { bold: true, size: 10, italic: true, color: { argb: 'FF475569' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getRow(2).height = 18;

    sheet.addRow([]); // dòng trống ngăn cách
  }

  private styleHeaderRow(row: ExcelJS.Row) {
    row.eachCell((cell) => {
      cell.font = { bold: true, size: 10, color: { argb: HVE_HEADER_TEXT } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HVE_BRAND_BLUE } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFDCE3EC' } },
        left: { style: 'thin', color: { argb: 'FFDCE3EC' } },
        bottom: { style: 'thin', color: { argb: 'FFDCE3EC' } },
        right: { style: 'thin', color: { argb: 'FFDCE3EC' } },
      };
    });
    row.height = 22;
  }

  private styleDataRow(row: ExcelJS.Row, isEven: boolean, highlight?: boolean) {
    row.eachCell((cell) => {
      cell.font = { size: 10, color: { argb: 'FF1E293B' } };
      cell.alignment = { vertical: 'middle' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: highlight ? HVE_AMBER : isEven ? HVE_LIGHT_ROW : 'FFFFFFFF' },
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFEDF1F7' } },
        left: { style: 'thin', color: { argb: 'FFEDF1F7' } },
        bottom: { style: 'thin', color: { argb: 'FFEDF1F7' } },
        right: { style: 'thin', color: { argb: 'FFEDF1F7' } },
      };
      if (highlight) cell.font = { size: 10, bold: true, color: { argb: HVE_AMBER_TEXT } };
    });
  }

  private autoFitColumns(sheet: ExcelJS.Worksheet, headers: string[], minWidths: number[]) {
    headers.forEach((h, i) => {
      const col = sheet.getColumn(i + 1);
      let maxLen = h.length;
      col.eachCell({ includeEmpty: false }, (cell) => {
        const len = String(cell.value ?? '').length;
        if (len > maxLen) maxLen = len;
      });
      col.width = Math.min(Math.max(maxLen + 3, minWidths[i] || 10), 45);
    });
  }

  async exportXlsx(user: any, type: string, filter: ReportFilterDto): Promise<Buffer> {
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

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'HVE Work';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(this.reportTitle(type).slice(0, 31), {
      views: [{ state: 'frozen', ySplit: 4 }],
      pageSetup: { orientation: 'landscape', fitToPage: true },
    });

    if (type === 'documents') {
      const summary = await this.getSummary(user, filter);
      const headers = ['Mã hồ sơ', 'Tiêu đề', 'Loại hồ sơ', 'Trạng thái', 'Người tạo', 'Phòng ban', 'Ngày tạo'];
      this.buildSheetHeader(sheet, this.reportTitle(type), headers.length);
      const headerRow = sheet.addRow(headers);
      this.styleHeaderRow(headerRow);
      summary.documents.items.forEach((d: any, idx: number) => {
        const row = sheet.addRow([
          d.code,
          d.title,
          this.mapDocType(d.type),
          d.status,
          d.creator,
          d.department,
          new Date(d.createdAt).toLocaleDateString('vi-VN'),
        ]);
        this.styleDataRow(row, idx % 2 === 0);
      });
      this.autoFitColumns(sheet, headers, [12, 30, 16, 14, 18, 22, 12]);
    } else if (type === 'tasks') {
      const summary = await this.getSummary(user, filter);
      const headers = ['Mã công việc', 'Tiêu đề', 'Mức ưu tiên', 'Trạng thái', 'Tiến độ (%)', 'Người thực hiện', 'Phòng ban', 'Hạn hoàn thành', 'Quá hạn'];
      this.buildSheetHeader(sheet, this.reportTitle(type), headers.length);
      const headerRow = sheet.addRow(headers);
      this.styleHeaderRow(headerRow);
      summary.tasks.items.forEach((t: any, idx: number) => {
        const row = sheet.addRow([
          t.code,
          t.title,
          t.priority,
          t.status,
          t.progressPercent,
          t.assignee,
          t.department,
          t.dueDate ? new Date(t.dueDate).toLocaleDateString('vi-VN') : '',
          t.isOverdue ? 'Có' : 'Không',
        ]);
        this.styleDataRow(row, idx % 2 === 0, t.isOverdue);
      });
      this.autoFitColumns(sheet, headers, [14, 30, 12, 14, 12, 18, 22, 14, 10]);
    } else if (type === 'contracts') {
      const summary = await this.getSummary(user, filter);
      const headers = ['Mã hợp đồng', 'Tiêu đề', 'Đối tác', 'Giá trị (VNĐ)', 'Ngày hiệu lực', 'Ngày hết hạn', 'Người phụ trách', 'Trạng thái', 'Sắp hết hạn'];
      this.buildSheetHeader(sheet, this.reportTitle(type), headers.length);
      const headerRow = sheet.addRow(headers);
      this.styleHeaderRow(headerRow);
      summary.contracts.items.forEach((c: any, idx: number) => {
        const row = sheet.addRow([
          c.code,
          c.title,
          c.partner,
          c.value,
          c.startDate ? new Date(c.startDate).toLocaleDateString('vi-VN') : '',
          c.endDate ? new Date(c.endDate).toLocaleDateString('vi-VN') : '',
          c.manager,
          c.status,
          c.isExpiringSoon ? 'Có' : 'Không',
        ]);
        row.getCell(4).numFmt = '#,##0';
        this.styleDataRow(row, idx % 2 === 0, c.isExpiringSoon);
      });
      this.autoFitColumns(sheet, headers, [14, 30, 20, 16, 14, 14, 18, 14, 12]);
    } else if (type === 'audit_logs') {
      const logs = await this.getAuditLogs(user, {
        startDate: filter.startDate,
        endDate: filter.endDate,
        limit: 1000,
      });
      const headers = ['ID', 'Đối tượng', 'Mã bản ghi', 'Hành động', 'Người thao tác', 'Địa chỉ IP', 'Thời gian'];
      this.buildSheetHeader(sheet, this.reportTitle(type), headers.length);
      const headerRow = sheet.addRow(headers);
      this.styleHeaderRow(headerRow);
      logs.forEach((l: any, idx: number) => {
        const row = sheet.addRow([
          l.id,
          l.entityType,
          l.entityId || '',
          l.action,
          l.actor?.name || 'Hệ thống',
          l.ip || '',
          new Date(l.createdAt).toLocaleString('vi-VN'),
        ]);
        this.styleDataRow(row, idx % 2 === 0);
      });
      this.autoFitColumns(sheet, headers, [8, 14, 12, 20, 20, 16, 20]);
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}
