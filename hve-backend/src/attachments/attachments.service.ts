import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
];

const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.docx',
  '.xlsx',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const STORAGE_SIGN_SECRET = process.env.JWT_SECRET || 'hve-upload-hmac-signature-secret-key';

@Injectable()
export class AttachmentsService {
  private uploadDir = path.resolve(process.cwd(), 'uploads');

  constructor(private prisma: PrismaService) {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  createSignature(fileKey: string, userId: number, expiresAt: number): string {
    return crypto
      .createHmac('sha256', STORAGE_SIGN_SECRET)
      .update(`${fileKey}:${userId}:${expiresAt}`)
      .digest('hex');
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

    const ext = path.extname(data.fileName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(
        'Phần mở rộng của tệp không được hỗ trợ. Chỉ chấp nhận: .pdf, .docx, .xlsx, .jpg, .png, .webp.',
      );
    }

    const sanitizedBase = path
      .basename(data.fileName, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileKey = `${Date.now()}-${sanitizedBase}${ext}`;

    const expiresIn = 900; // 15 minutes
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
    const token = this.createSignature(fileKey, uploadedById, expiresAt);

    const uploadUrl = `/attachments/upload-storage/${fileKey}?token=${token}&expires=${expiresAt}&user=${uploadedById}`;
    const fileUrl = `/attachments/file/${fileKey}`;


    return {
      uploadUrl,
      fileUrl,
      fileKey,
      token,
      expiresAt,
      expiresIn,
      uploadedById,
    };
  }

  async saveUploadedFile(
    fileKey: string,
    buffer: Buffer,
    userId: number,
    token?: string,
    expires?: number,
  ) {
    // 1. Chống path traversal
    const safeKey = path.basename(fileKey);
    if (!safeKey || safeKey !== fileKey) {
      throw new BadRequestException('Tên tệp tin không hợp lệ.');
    }

    // 2. Xác thực tính hợp lệ của token và hạn dùng
    if (token && expires) {
      const now = Math.floor(Date.now() / 1000);
      if (now > expires) {
        throw new ForbiddenException('Pre-signed URL đã hết hạn. Vui lòng xin cấp URL mới.');
      }
      const expectedSignature = this.createSignature(fileKey, userId, expires);
      if (token !== expectedSignature) {
        throw new ForbiddenException('Chữ ký xác thực tải lên không hợp lệ.');
      }
    }

    // 3. Kiểm tra dung lượng buffer thực tế
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Dữ liệu tệp tin tải lên rỗng.');
    }

    if (buffer.length > MAX_FILE_SIZE) {
      throw new BadRequestException('Dung lượng tệp vượt quá giới hạn 10MB.');
    }

    // 4. Kiểm tra đuôi mở rộng của tệp tin
    const ext = path.extname(safeKey).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException('Định dạng phần mở rộng tệp không được hỗ trợ.');
    }

    const destPath = path.join(this.uploadDir, safeKey);
    await fs.promises.writeFile(destPath, buffer);

    return {
      success: true,
      fileKey: safeKey,
      fileUrl: `/attachments/file/${safeKey}`,
      size: buffer.length,
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
