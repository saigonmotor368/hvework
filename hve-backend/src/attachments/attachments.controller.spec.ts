import { Test, TestingModule } from '@nestjs/testing';
import { AttachmentsController } from './attachments.controller.js';
import { AttachmentsService } from './attachments.service.js';
import { GoogleDriveService } from './google-drive.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { HttpStatus } from '@nestjs/common';
import { Readable } from 'stream';


describe('AttachmentsController', () => {
  let controller: AttachmentsController;
  let service: any;
  let googleDrive: any;

  beforeEach(async () => {
    service = {
      generatePresignedUrl: vi.fn(),
      saveUploadedFile: vi.fn(),
      createAttachment: vi.fn(),
      getAttachmentsForEntity: vi.fn(),
    };

    googleDrive = {
      downloadFile: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttachmentsController],
      providers: [
        { provide: AttachmentsService, useValue: service },
        { provide: GoogleDriveService, useValue: googleDrive },
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
    it('should return 404 if file does not exist on Google Drive', async () => {
      googleDrive.downloadFile.mockRejectedValue(new Error('File not found'));

      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        setHeader: vi.fn(),
      };

      await controller.getFile('definitely-non-existent-file-999', res);
      expect(res.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Không tìm thấy') }),
      );
    });

    it('should stream file and set Content-Type if exists on Google Drive', async () => {
      const stream = Readable.from([Buffer.from('test')]);
      googleDrive.downloadFile.mockResolvedValue({ stream, mimeType: 'application/pdf' });

      // res cần tương thích Writable stream thật sự vì controller gọi stream.pipe(res)
      const { PassThrough } = await import('stream');
      const res: any = new PassThrough();
      res.status = vi.fn().mockReturnThis();
      res.json = vi.fn();
      res.setHeader = vi.fn();

      await controller.getFile('mock-drive-file-id', res);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    });
  });
});

