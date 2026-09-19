import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import {
  ReviewProjectReportDto,
  UpsertProjectReportDto,
} from './dto/project-report.dto.js';
import { ProjectReportsService } from './project-reports.service.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('project-reports')
export class ProjectReportsController {
  constructor(private readonly service: ProjectReportsService) {}

  @Get()
  findAll(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('projectId') projectId?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll(req.user, {
      status,
      projectId: projectId ? Number(projectId) : undefined,
      search,
    });
  }

  @Get('viewers')
  getViewerOptions() {
    return this.service.getViewerOptions();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.findOne(req.user, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: UpsertProjectReportDto, @Req() req: any) {
    return this.service.create(req.user, dto, req.ip);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertProjectReportDto,
    @Req() req: any,
  ) {
    return this.service.update(req.user, id, dto, req.ip);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.service.remove(req.user, id, req.ip);
  }

  @Post(':id/submit')
  submit(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.submit(req.user, id, req.ip);
  }

  @Post(':id/review')
  review(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewProjectReportDto,
    @Req() req: any,
  ) {
    return this.service.review(req.user, id, dto, req.ip);
  }
}
