import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DocumentsService } from './documents.service.js';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto.js';
import { UpdatePaymentRequestDto } from './dto/update-payment-request.dto.js';
import { ActionStepDto, RejectOrReturnStepDto } from './dto/action-step.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  @Post('payment-requests')
  @HttpCode(HttpStatus.CREATED)
  async createPaymentRequest(
    @Body() dto: CreatePaymentRequestDto,
    @Req() req: any,
  ) {
    return this.documentsService.createPaymentRequest(req.user.id, dto, req.ip);
  }

  @Get()
  async findAll(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('tab') tab?: string,
  ) {
    return this.documentsService.findAll(req.user, { status, type, tab });
  }

  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.documentsService.findById(id);
  }

  @Put(':id')
  async updatePaymentRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePaymentRequestDto,
    @Query('version') version: string,
    @Req() req: any,
  ) {
    const currentVersion = version ? parseInt(version, 10) : undefined;
    return this.documentsService.updatePaymentRequest(
      id,
      req.user.id,
      dto,
      currentVersion,
      req.ip,
    );
  }

  @Delete(':id')
  async deletePaymentRequest(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    return this.documentsService.deletePaymentRequest(id, req.user.id, req.ip);
  }

  @Post(':id/new-version')
  @HttpCode(HttpStatus.CREATED)
  async createNewVersion(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    return this.documentsService.createNewVersion(id, req.user.id, req.ip);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  async submitForApproval(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    return this.documentsService.submitForApproval(id, req.user.id, req.ip);
  }

  @Post(':id/steps/:stepId/approve')
  @HttpCode(HttpStatus.OK)
  async approveStep(
    @Param('id', ParseIntPipe) id: number,
    @Param('stepId', ParseIntPipe) stepId: number,
    @Body() dto: ActionStepDto,
    @Query('version') version: string,
    @Req() req: any,
  ) {
    const currentVersion = version ? parseInt(version, 10) : undefined;
    return this.documentsService.approveStep(
      id,
      stepId,
      req.user,
      dto,
      currentVersion,
      req.ip,
    );
  }

  @Post(':id/steps/:stepId/return')
  @HttpCode(HttpStatus.OK)
  async returnStep(
    @Param('id', ParseIntPipe) id: number,
    @Param('stepId', ParseIntPipe) stepId: number,
    @Body() dto: RejectOrReturnStepDto,
    @Query('version') version: string,
    @Req() req: any,
  ) {
    const currentVersion = version ? parseInt(version, 10) : undefined;
    return this.documentsService.returnStep(
      id,
      stepId,
      req.user,
      dto,
      currentVersion,
      req.ip,
    );
  }

  @Post(':id/steps/:stepId/reject')
  @HttpCode(HttpStatus.OK)
  async rejectStep(
    @Param('id', ParseIntPipe) id: number,
    @Param('stepId', ParseIntPipe) stepId: number,
    @Body() dto: RejectOrReturnStepDto,
    @Query('version') version: string,
    @Req() req: any,
  ) {
    const currentVersion = version ? parseInt(version, 10) : undefined;
    return this.documentsService.rejectStep(
      id,
      stepId,
      req.user,
      dto,
      currentVersion,
      req.ip,
    );
  }
}
