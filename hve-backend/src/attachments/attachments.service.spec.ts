import { Test, TestingModule } from '@nestjs/testing';
import { AttachmentsService } from './attachments.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BadRequestException } from '@nestjs/common';



describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      attachment: {
        findFirst: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AttachmentsService>(AttachmentsService);
  });

  describe('generatePresignedUrl', () => {
    it('should generate pre-signed upload URL and file URL for valid PDF', () => {
      const result = service.generatePresignedUrl(10, {
        fileName: 'hoa_don.pdf',
        mimeType: 'application/pdf',
        size: 1024 * 1024,
      });

      expect(result).toHaveProperty('uploadUrl');
      expect(result).toHaveProperty('fileUrl');
      expect(result).toHaveProperty('fileKey');
      expect(result.uploadUrl).toContain('/attachments/upload-storage/');
      expect(result.fileUrl).toContain('/attachments/file/');
      expect(result.expiresIn).toBe(900);
    });

    it('should throw BadRequestException if MIME type is not allowed (e.g. .exe)', () => {
      expect(() =>
        service.generatePresignedUrl(10, {
          fileName: 'virus.exe',
          mimeType: 'application/x-msdownload',
          size: 1024,
        }),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException if file exceeds 10MB limit', () => {
      expect(() =>
        service.generatePresignedUrl(10, {
          fileName: 'large_file.pdf',
          mimeType: 'application/pdf',
          size: 11 * 1024 * 1024,
        }),
      ).toThrow('Dung lượng tệp vượt quá giới hạn 10MB');
    });
  });

  describe('createAttachment', () => {
    it('should create attachment with version 1 if first upload', async () => {
      prisma.attachment.findFirst.mockResolvedValue(null);
      prisma.attachment.create.mockResolvedValue({
        id: 1,
        fileName: 'hoa_don.pdf',
        version: 1,
      });

      const result = await service.createAttachment(10, {
        fileName: 'hoa_don.pdf',
        mimeType: 'application/pdf',
        size: 500000,
        fileUrl: '/uploads/hoa_don.pdf',
        entityType: 'document',
        entityId: 100,
      });

      expect(result.version).toBe(1);
    });

    it('should increment version if file with same name already exists on entity', async () => {
      prisma.attachment.findFirst.mockResolvedValue({
        id: 1,
        fileName: 'hoa_don.pdf',
        version: 1,
      });
      prisma.attachment.create.mockResolvedValue({
        id: 2,
        fileName: 'hoa_don.pdf',
        version: 2,
      });

      const result = await service.createAttachment(10, {
        fileName: 'hoa_don.pdf',
        mimeType: 'application/pdf',
        size: 500000,
        fileUrl: '/uploads/hoa_don_v2.pdf',
        entityType: 'document',
        entityId: 100,
      });

      expect(result.version).toBe(2);
    });
  });

  describe('saveUploadedFile', () => {
    it('should successfully save file with valid signature and buffer', async () => {
      const presign = service.generatePresignedUrl(10, {
        fileName: 'chung_tu.pdf',
        mimeType: 'application/pdf',
        size: 1024,
      });

      const buffer = Buffer.from('fake-pdf-content');
      const result = await service.saveUploadedFile(
        presign.fileKey,
        buffer,
        10,
        presign.token,
        presign.expiresAt,
      );

      expect(result.success).toBe(true);
      expect(result.fileUrl).toContain('/attachments/file/');
      expect(result.size).toBe(buffer.length);
    });

    it('should throw ForbiddenException if token signature is invalid', async () => {
      const buffer = Buffer.from('fake-pdf-content');
      await expect(
        service.saveUploadedFile('test.pdf', buffer, 10, 'invalid-signature-hash', Math.floor(Date.now() / 1000) + 600),
      ).rejects.toThrow('Chữ ký xác thực tải lên không hợp lệ.');
    });

    it('should throw ForbiddenException if token is expired', async () => {
      const buffer = Buffer.from('fake-pdf-content');
      const expiredTime = Math.floor(Date.now() / 1000) - 100; // đã hết hạn
      const token = service.createSignature('test.pdf', 10, expiredTime);

      await expect(
        service.saveUploadedFile('test.pdf', buffer, 10, token, expiredTime),
      ).rejects.toThrow('Pre-signed URL đã hết hạn');
    });

    it('should throw BadRequestException if buffer exceeds 10MB', async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      await expect(
        service.saveUploadedFile('test.pdf', largeBuffer, 10),
      ).rejects.toThrow('Dung lượng tệp vượt quá giới hạn 10MB');
    });

    it('should throw BadRequestException if file extension is not allowed', async () => {
      const buffer = Buffer.from('malicious-script');
      await expect(
        service.saveUploadedFile('malware.exe', buffer, 10),
      ).rejects.toThrow('Định dạng phần mở rộng tệp không được hỗ trợ');
    });

    it('should throw BadRequestException on path traversal attempt', async () => {
      const buffer = Buffer.from('data');
      await expect(
        service.saveUploadedFile('../../etc/passwd', buffer, 10),
      ).rejects.toThrow('Tên tệp tin không hợp lệ.');
    });
  });
});

