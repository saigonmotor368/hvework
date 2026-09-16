import { Test, TestingModule } from '@nestjs/testing';
import { AttachmentsController } from './attachments.controller.js';
import { AttachmentsService } from './attachments.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { HttpStatus } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';


describe('AttachmentsController', () => {
  let controller: AttachmentsController;
  let service: any;

  beforeEach(async () => {
    service = {
      generatePresignedUrl: vi.fn(),
      saveUploadedFile: vi.fn(),
      createAttachment: vi.fn(),
      getAttachmentsForEntity: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttachmentsController],
      providers: [
        { provide: AttachmentsService, useValue: service },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AttachmentsController>(AttachmentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPresignedUrl', () => {
    it('should return presigned url with fileUrl pointing to /attachments/file/', async () => {
      service.generatePresignedUrl.mockReturnValue({
        uploadUrl: '/attachments/upload-storage/123-test.pdf?token=abc',
        fileUrl: '/attachments/file/123-test.pdf',
        fileKey: '123-test.pdf',
      });

      const result = await controller.getPresignedUrl(
        { fileName: 'test.pdf', mimeType: 'application/pdf', size: 1000 },
        { user: { id: 10 } },
      );

      expect(result.fileUrl).toBe('/attachments/file/123-test.pdf');
      expect(service.generatePresignedUrl).toHaveBeenCalledWith(10, {
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
        size: 1000,
      });
    });
  });

  describe('getFile', () => {
    it('should return 404 if file does not exist on disk', async () => {
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        sendFile: vi.fn(),
      };

      await controller.getFile('definitely-non-existent-file-999.pdf', res);
      expect(res.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Không tìm thấy') }),
      );
    });

    it('should send file if exists on disk', async () => {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const dummyFile = path.join(uploadsDir, 'test-unit-real.pdf');
      fs.writeFileSync(dummyFile, 'test');

      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        sendFile: vi.fn(),
      };

      try {
        await controller.getFile('test-unit-real.pdf', res);
        expect(res.sendFile).toHaveBeenCalledWith(
          expect.stringContaining('test-unit-real.pdf'),
        );
      } finally {
        if (fs.existsSync(dummyFile)) {
          fs.unlinkSync(dummyFile);
        }
      }
    });
  });
});

