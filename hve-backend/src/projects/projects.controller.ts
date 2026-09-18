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
import {
  CreateProjectDto,
  UpdateProjectDto,
} from './dto/upsert-project.dto.js';
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
}
