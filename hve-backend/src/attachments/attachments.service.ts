import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as fs from 'fs';
import * as path from 'path';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file

@Injectable()
export class AttachmentsService {
  private uploadDir = path.resolve(process.cwd(), 'uploads');

  constructor(private prisma: PrismaService) {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  generatePresignedUrl(
    uploadedById: number,
    data: { fileName: string; mimeType: string; size: number },
  ) {
    if (!ALLOWED_MIME_TYPES.includes(data.mimeType)) {
      throw new BadRequestException(
        'Định dạng tệp không được hỗ trợ. Chỉ chấp nhận: PDF, DOCX, XLSX, JPG, PNG, WEBP.',
      );
    }

    if (data.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        'Dung lượng tệp vượt quá giới hạn 10MB. Vui lòng chọn tệp nhỏ hơn.',
      );
    }

    const ext = path.extname(data.fileName);
    const sanitizedBase = path
      .basename(data.fileName, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileKey = `${Date.now()}-${sanitizedBase}${ext}`;

    const uploadUrl = `/attachments/upload-storage/${fileKey}`;
    const fileUrl = `/uploads/${fileKey}`;

    return {
      uploadUrl,
      fileUrl,
      fileKey,
      expiresIn: 900, // 15 minutes
      uploadedById,
    };
  }

  async saveUploadedFile(fileKey: string, buffer: Buffer) {
    const safeKey = path.basename(fileKey);
    const destPath = path.join(this.uploadDir, safeKey);
    await fs.promises.writeFile(destPath, buffer);
    return {
      success: true,
      fileKey: safeKey,
      fileUrl: `/uploads/${safeKey}`,
    };
  }

  async createAttachment(
    uploadedById: number,
    data: {
      fileName: string;
      mimeType: string;
      size: number;
      fileUrl: string;
      entityType?: string;
      entityId?: number;
    },
  ) {
    if (!ALLOWED_MIME_TYPES.includes(data.mimeType)) {
      throw new BadRequestException(
        'Định dạng tệp không được hỗ trợ. Chỉ chấp nhận: PDF, DOCX, XLSX, JPG, PNG, WEBP.',
      );
    }

    if (data.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        'Dung lượng tệp vượt quá giới hạn 10MB. Vui lòng chọn tệp nhỏ hơn.',
      );
    }

    // Check existing version count for same entity & filename
    let version = 1;
    if (data.entityType && data.entityId) {
      const existing = await this.prisma.attachment.findFirst({
        where: {
          entityType: data.entityType,
          entityId: data.entityId,
          fileName: data.fileName,
        },
        orderBy: { version: 'desc' },
      });
      if (existing) {
        version = existing.version + 1;
      }
    }

    return this.prisma.attachment.create({
      data: {
        fileName: data.fileName,
        mimeType: data.mimeType,
        size: data.size,
        fileUrl: data.fileUrl,
        entityType: data.entityType || 'document',
        entityId: data.entityId || 0,
        version,
        uploadedById,
      },
    });
  }

  async getAttachmentsForEntity(entityType: string, entityId: number) {
    return this.prisma.attachment.findMany({
      where: { entityType, entityId },
      orderBy: { uploadedAt: 'desc' },
    });
  }
}
