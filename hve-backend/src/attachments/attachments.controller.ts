import {
  Controller,
  Post,
  Put,
  Get,
  Body,
  Param,
  Query,
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
import type { Response } from 'express';
import * as path from 'path';

import * as fs from 'fs';


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

  // Pre-signed upload destination endpoint (yêu cầu đăng nhập + chữ ký token hợp lệ)
  @UseGuards(JwtAuthGuard)
  @Put('upload-storage/:fileKey')
  async uploadFileToStorage(
    @Param('fileKey') fileKey: string,
    @Query('token') token: string,
    @Query('expires') expiresStr: string,
    @Query('user') userStr: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const userId = req.user.id;
    const expires = expiresStr ? parseInt(expiresStr, 10) : undefined;

    // Kiểm tra tính nhất quán giữa user trong token và user đăng nhập
    if (userStr && parseInt(userStr, 10) !== userId) {
      return res.status(HttpStatus.FORBIDDEN).json({
        message: 'Tài khoản tải lên không khớp với thông tin được cấp quyền pre-signed URL.',
      });
    }

    const chunks: Buffer[] = [];
    let totalSize = 0;
    const MAX_ALLOWED_STREAM_SIZE = 10 * 1024 * 1024; // 10MB
    let hasExceededLimit = false;

    req.on('data', (chunk: Buffer) => {
      totalSize += chunk.length;
      if (totalSize > MAX_ALLOWED_STREAM_SIZE) {
        hasExceededLimit = true;
        req.destroy(); // Ngắt kết nối ngay lập tức chống DoS ổ đĩa / bộ nhớ
      } else {
        chunks.push(chunk);
      }
    });

    req.on('end', async () => {
      if (hasExceededLimit) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          message: 'Dung lượng tệp vượt quá giới hạn tối đa 10MB.',
        });
      }

      try {
        const buffer = Buffer.concat(chunks);
        const result = await this.attachmentsService.saveUploadedFile(
          fileKey,
          buffer,
          userId,
          token,
          expires,
        );
        return res.status(HttpStatus.OK).json(result);
      } catch (err: any) {
        const status = err.status || HttpStatus.BAD_REQUEST;
        return res.status(status).json({ message: err.message });
      }
    });

    req.on('error', (err: any) => {
      if (!res.headersSent) {
        res.status(HttpStatus.BAD_REQUEST).json({
          message: err.message || 'Lỗi trong quá trình truyền tải tệp tin.',
        });
      }
    });
  }

  // Endpoint xem/tải tệp đính kèm có kiểm tra quyền đăng nhập
  @UseGuards(JwtAuthGuard)
  @Get('file/:fileKey')
  async getFile(
    @Param('fileKey') fileKey: string,
    @Res() res: Response,
  ) {
    const safeKey = path.basename(fileKey);
    const filePath = path.join(process.cwd(), 'uploads', safeKey);
    if (!fs.existsSync(filePath)) {
      return res.status(HttpStatus.NOT_FOUND).json({ message: 'Không tìm thấy tệp tin trên hệ thống.' });
    }
    return res.sendFile(filePath);
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
