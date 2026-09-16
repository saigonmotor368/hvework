import { Controller, Get, Query, Request, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportFilterDto } from './dto/report-filter.dto';
import { ReportsService } from './reports.service';

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

  @Get('export')
  async exportCsv(
    @Request() req: any,
    @Query('type') type: string,
    @Query() query: ReportFilterDto,
    @Res() res: Response,
  ) {
    const csvData = await this.reportsService.exportCsv(req.user, type || 'documents', query);
    const filename = `HVE_Report_${type || 'documents'}_${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csvData);
  }
}
