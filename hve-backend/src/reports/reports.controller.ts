import { Controller, Get, Query, Request, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ReportFilterDto } from './dto/report-filter.dto.js';
import { ReportsService } from './reports.service.js';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  async getSummary(@Request() req: any, @Query() query: ReportFilterDto) {
    return this.reportsService.getSummary(req.user, query);
  }

  @Get('audit-logs')
  async getAuditLogs(
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('entityType') entityType?: string,
    @Query('limit') limit?: number,
  ) {
    return this.reportsService.getAuditLogs(req.user, {
      startDate,
      endDate,
      entityType,
      limit: limit ? Number(limit) : 200,
    });
  }

  // `reportType` chọn khối báo cáo (documents/tasks/contracts/audit_logs).
  // `query.type` (ReportFilterDto) chỉ lọc theo loại hồ sơ cụ thể (vd payment_request)
  // trong khối "documents" — hai tham số tách riêng để không bao giờ trùng khoá
  // query string (trước đây cả hai đều dùng chung tên `type`, khiến khi lọc
  // theo loại hồ sơ, Express gộp thành mảng và Prisma ném lỗi validation,
  // làm toàn bộ việc xuất báo cáo thất bại).
  private fileLabel(reportType: string, query: ReportFilterDto): string {
    if (reportType === 'documents' && typeof query.type === 'string' && query.type) {
      return query.type;
    }
    return reportType;
  }

  @Get('export')
  async exportCsv(
    @Request() req: any,
    @Query('reportType') reportType: string,
    @Query() query: ReportFilterDto,
    @Res() res: Response,
  ) {
    const kind = reportType || 'documents';
    const csvData = await this.reportsService.exportCsv(req.user, kind, query);
    const filename = `HVE_Report_${this.fileLabel(kind, query)}_${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csvData);
  }

  @Get('export-xlsx')
  async exportXlsx(
    @Request() req: any,
    @Query('reportType') reportType: string,
    @Query() query: ReportFilterDto,
    @Res() res: Response,
  ) {
    const kind = reportType || 'documents';
    const buffer = await this.reportsService.exportXlsx(req.user, kind, query);
    const filename = `HVE_BaoCao_${this.fileLabel(kind, query)}_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  }
}
