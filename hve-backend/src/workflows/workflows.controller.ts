import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WorkflowsService } from './workflows.service.js';
import { UpdateWorkflowTemplateDto } from './dto/update-workflow-template.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('it_admin', 'ceo')
@Controller('workflows')
export class WorkflowsController {
  constructor(private workflowsService: WorkflowsService) {}

  @Get()
  async findAll() {
    return this.workflowsService.findAll();
  }

  @Get(':type')
  async findByType(@Param('type') type: string) {
    return this.workflowsService.findByType(type);
  }

  @Put(':type')
  @HttpCode(HttpStatus.OK)
  async updateTemplate(
    @Param('type') type: string,
    @Body() dto: UpdateWorkflowTemplateDto,
    @Req() req: any,
  ) {
    return this.workflowsService.updateTemplate(
      type,
      dto,
      req.user.id,
      req.ip,
    );
  }
}
