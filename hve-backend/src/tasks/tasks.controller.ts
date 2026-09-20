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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { TasksService } from './tasks.service.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { UpdateProgressDto } from './dto/update-progress.dto.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { TaskQueryDto } from './dto/task-query.dto.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @Roles('department_head', 'ceo', 'bgd')
  @HttpCode(HttpStatus.CREATED)
  async createTask(@Body() dto: CreateTaskDto, @Req() req: any) {
    return this.tasksService.createTask(req.user, dto, req.ip);
  }

  @Get()
  async getTasks(@Query() query: TaskQueryDto, @Req() req: any) {
    return this.tasksService.findAll(req.user, query);
  }

  @Get('users')
  @Roles('department_head', 'ceo', 'bgd')
  async getAssignableUsers(@Req() req: any) {
    return this.tasksService.getAssignableUsers(req.user);
  }

  @Get('workload')
  async getWorkloadSummary(
    @Req() req: any,
    @Query('projectId', new ParseIntPipe({ optional: true }))
    projectId?: number,
  ) {
    return this.tasksService.getWorkloadSummary(req.user, projectId);
  }

  @Get(':id')
  async getTaskById(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.tasksService.findById(req.user, id);
  }

  @Put(':id')
  async updateTask(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskDto,
    @Req() req: any,
  ) {
    return this.tasksService.updateTask(req.user, id, dto, req.ip);
  }

  @Put(':id/progress')
  async updateProgress(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProgressDto,
    @Req() req: any,
  ) {
    return this.tasksService.updateProgress(req.user, id, dto, req.ip);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  async acceptTask(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    return this.tasksService.acceptTask(req.user, id, req.ip);
  }

  @Post(':id/confirm-completion')
  @HttpCode(HttpStatus.OK)
  async confirmCompletion(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    return this.tasksService.confirmCompletion(req.user, id, req.ip);
  }

  @Post(':id/comments')
  @HttpCode(HttpStatus.CREATED)
  async addComment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCommentDto,
    @Req() req: any,
  ) {
    return this.tasksService.addComment(req.user, id, dto);
  }
}
