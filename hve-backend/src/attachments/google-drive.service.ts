import { Injectable, InternalServerErrorException, OnModuleInit } from '@nestjs/common';
import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';

/**
 * Lưu trữ tệp đính kèm qua Google Drive (Shared Drive của công ty, 30GB)
 * thay vì ổ đĩa server — bắt buộc khi chạy trên Vercel serverless vì
 * filesystem không lưu trữ lâu dài giữa các lần gọi hàm.
 *
 * Xác thực bằng Service Account. LƯU Ý: Service Account không có dung
 * lượng lưu trữ riêng trên "My Drive" cá nhân (Google chặn hẳn, lỗi 403
 * "Service Accounts do not have storage quota") — bắt buộc phải dùng
 * Shared Drive (ổ đĩa dùng chung, tính năng Google Workspace) và thêm
 * service account làm thành viên (Content Manager trở lên). GOOGLE_DRIVE_FOLDER_ID
 * ở đây là ID của thư mục bên trong Shared Drive đó (hoặc chính Shared Drive
 * làm thư mục gốc) — mọi lệnh gọi Drive API đều cần supportsAllDrives: true.
 */
@Injectable()
export class GoogleDriveService implements OnModuleInit {
  private drive: drive_v3.Drive | null = null;
  private folderId: string | undefined;

  onModuleInit() {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!email || !privateKey || !this.folderId) {
      // Cho phép app khởi động khi thiếu cấu hình (ví dụ môi trường dev/test
      // chưa cấu hình Drive) — lỗi rõ ràng chỉ xảy ra khi thực sự gọi upload/download.
      return;
    }

    const auth = new google.auth.JWT({
      email,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    this.drive = google.drive({ version: 'v3', auth });
  }

  private ensureReady(): drive_v3.Drive {
    if (!this.drive || !this.folderId) {
      throw new InternalServerErrorException(
        'Chưa cấu hình Google Drive (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY / GOOGLE_DRIVE_FOLDER_ID).',
      );
    }
    return this.drive;
  }

  async uploadFile(fileName: string, buffer: Buffer, mimeType: string): Promise<string> {
    const drive = this.ensureReady();
    const res = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [this.folderId as string],
      },
      media: {
        mimeType,
        body: Readable.from(buffer),
      },
      fields: 'id',
      supportsAllDrives: true,
    });

    if (!res.data.id) {
      throw new InternalServerErrorException('Tải tệp lên Google Drive thất bại.');
    }
    return res.data.id;
  }

  async downloadFile(driveFileId: string): Promise<{ stream: Readable; mimeType: string }> {
    const drive = this.ensureReady();
    const meta = await drive.files.get({
      fileId: driveFileId,
      fields: 'mimeType',
      supportsAllDrives: true,
    });
    const res = await drive.files.get(
      { fileId: driveFileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' },
    );
    return { stream: res.data as unknown as Readable, mimeType: meta.data.mimeType || 'application/octet-stream' };
  }
}
