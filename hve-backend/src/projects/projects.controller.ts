import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CreateProjectDto, UpdateProjectDto } from './dto/upsert-project.dto.js';
import { CreateBoardMessageDto } from './dto/create-board-message.dto.js';
import { ProjectsService } from './projects.service.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async findVisible(@Req() req: any) {
    return this.projectsService.findVisible(req.user);
  }

  @Get('admin')
  @Roles('ceo', 'it_admin')
  async findAllForAdmin() {
    return this.projectsService.findAllForAdmin();
  }

  @Post()
  @Roles('ceo', 'it_admin')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateProjectDto, @Req() req: any) {
    return this.projectsService.create(dto, req.user.id, req.ip);
  }

  @Put(':id')
  @Roles('ceo', 'it_admin')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectDto,
    @Req() req: any,
  ) {
    return this.projectsService.update(id, dto, req.user.id, req.ip);
  }

  // Bảng tin dự án: mọi thành viên/trưởng dự án được xem & đăng bài trong
  // dự án của mình; CEO/BGĐ/IT Admin xem được bảng tin của mọi dự án. Đây
  // là kênh giao lưu, không phải hành động nghiệp vụ (approve/reject...),
  // nên không giới hạn qua @Roles — kiểm tra thành viên ở service.
  @Get(':id/board')
  async getBoard(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.projectsService.getBoardMessages(req.user, id);
  }

  @Post(':id/board')
  @HttpCode(HttpStatus.CREATED)
  async postToBoard(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateBoardMessageDto,
    @Req() req: any,
  ) {
    return this.projectsService.postBoardMessage(req.user, id, dto);
  }
}
