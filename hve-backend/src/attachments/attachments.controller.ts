import {
  Controller,
  Post,
  Put,
  Get,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AttachmentsService } from './attachments.service.js';
import { GeneratePresignedUrlDto } from './dto/presigned-url.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { Request, Response } from 'express';

@Controller('attachments')
export class AttachmentsController {
  constructor(private attachmentsService: AttachmentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('presigned-url')
  @HttpCode(HttpStatus.OK)
  async getPresignedUrl(
    @Body() dto: GeneratePresignedUrlDto,
    @Req() req: any,
  ) {
    return this.attachmentsService.generatePresignedUrl(req.user.id, dto);
  }

  // Pre-signed upload destination endpoint (handles direct upload to server storage)
  @Put('upload-storage/:fileKey')
  async uploadFileToStorage(
    @Param('fileKey') fileKey: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        const result = await this.attachmentsService.saveUploadedFile(fileKey, buffer);
        res.status(HttpStatus.OK).json(result);
      } catch (err: any) {
        res.status(HttpStatus.BAD_REQUEST).json({ message: err.message });
      }
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async registerAttachment(
    @Body()
    body: {
      fileName: string;
      mimeType: string;
      size: number;
      fileUrl: string;
      entityType?: string;
      entityId?: number;
    },
    @Req() req: any,
  ) {
    return this.attachmentsService.createAttachment(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':entityType/:entityId')
  async getAttachments(
    @Param('entityType') entityType: string,
    @Param('entityId', ParseIntPipe) entityId: number,
  ) {
    return this.attachmentsService.getAttachmentsForEntity(entityType, entityId);
  }
}
