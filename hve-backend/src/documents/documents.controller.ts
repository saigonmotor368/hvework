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
import { CreateProposalDto } from './dto/create-proposal.dto.js';
import { CreateContractDto } from './dto/create-contract.dto.js';
import { UpdatePaymentRequestDto } from './dto/update-payment-request.dto.js';
import { ActionStepDto, RejectOrReturnStepDto } from './dto/action-step.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

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

  @Post('proposals')
  @HttpCode(HttpStatus.CREATED)
  async createProposal(
    @Body() dto: CreateProposalDto,
    @Req() req: any,
  ) {
    return this.documentsService.createProposal(req.user.id, dto, req.ip);
  }

  @Post('contracts')
  @HttpCode(HttpStatus.CREATED)
  async createContract(
    @Body() dto: CreateContractDto,
    @Req() req: any,
  ) {
    return this.documentsService.createContract(req.user.id, dto, req.ip);
  }

  @Get('contracts/expiring')
  async getExpiringContracts(
    @Req() req: any,
    @Query('offset') offset?: string,
  ) {
    const offsetDays = offset ? parseInt(offset, 10) : 30;
    return this.documentsService.getExpiringContracts(req.user, offsetDays);
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
  async findById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    return this.documentsService.findById(req.user, id);
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

  @Post(':id/approve-direct')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ceo')
  @HttpCode(HttpStatus.OK)
  async approveDirect(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActionStepDto,
    @Query('version') version: string,
    @Req() req: any,
  ) {
    const currentVersion = version ? parseInt(version, 10) : undefined;
    return this.documentsService.approveDirect(
      id,
      req.user,
      dto,
      currentVersion,
      req.ip,
    );
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
