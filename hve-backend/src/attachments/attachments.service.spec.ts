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
});
