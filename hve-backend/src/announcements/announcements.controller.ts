import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { AnnouncementsService } from './announcements.service.js';
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  findVisible(@Req() req: any, @Query('limit') limit?: string) {
    return this.announcementsService.findVisible(req.user, Number(limit) || 3);
  }

  @Get(':id/calendar.ics')
  async calendar(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Res() res: any,
  ) {
    const calendar = await this.announcementsService.buildCalendar(
      req.user,
      id,
    );
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="hve-work-event-${id}.ics"`,
    );
    res.send(calendar);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.announcementsService.findVisibleById(req.user, id);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('it_admin')
@Controller('admin/announcements')
export class AdminAnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.announcementsService.findAllForAdmin(
      status,
      projectId ? Number(projectId) : undefined,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateAnnouncementDto, @Req() req: any) {
    return this.announcementsService.create(dto, req.user.id, req.ip);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAnnouncementDto,
    @Req() req: any,
  ) {
    return this.announcementsService.update(id, dto, req.user.id, req.ip);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  publish(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.announcementsService.publish(id, req.user.id, req.ip);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  archive(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.announcementsService.archive(id, req.user.id, req.ip);
  }
}
