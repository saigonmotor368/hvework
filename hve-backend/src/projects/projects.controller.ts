import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
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

  @Get(':id/usage')
  @Roles('ceo', 'it_admin')
  async usage(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.getUsage(id);
  }

  @Patch(':id/status')
  @Roles('ceo', 'it_admin')
  async setStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { isActive: boolean },
    @Req() req: any,
  ) {
    return this.projectsService.setActive(id, body?.isActive === true, req.user.id, req.ip);
  }

  @Delete(':id')
  @Roles('ceo', 'it_admin')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.projectsService.remove(id, req.user.id, req.ip);
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
