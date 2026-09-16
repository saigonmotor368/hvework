import { describe, expect, it, vi } from 'vitest';
import {
  authenticatedFileUrl,
  markAllNotificationsRead,
  uploadAttachment,
  type Fetcher,
} from './client';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('API contracts', () => {
  it('uploads to the backend origin and registers the Google Drive file URL', async () => {
    const fetcher = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce(
        jsonResponse({ uploadUrl: '/attachments/upload-storage/temp.png?token=signed' }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ fileKey: 'drive-123', fileUrl: '/attachments/file/drive-123', size: 4 }),
      )
      .mockResolvedValueOnce(jsonResponse({ id: 42 }));
    const file = new File(['test'], 'proof.png', { type: 'image/png' });

    await expect(uploadAttachment('https://api.example.com', 'jwt', file, fetcher)).resolves.toBe(42);

    expect(fetcher.mock.calls[1][0]).toBe(
      'https://api.example.com/attachments/upload-storage/temp.png?token=signed',
    );
    expect(fetcher.mock.calls[2][0]).toBe('https://api.example.com/attachments/register');
    expect(JSON.parse(String(fetcher.mock.calls[2][1]?.body))).toMatchObject({
      fileUrl: '/attachments/file/drive-123',
      fileName: 'proof.png',
    });
  });

  it.each([
    [401, 'Phiên đăng nhập không hợp lệ'],
    [404, 'Không tìm thấy tệp'],
    [413, 'Dung lượng tệp vượt quá giới hạn'],
  ])('surfaces upload errors with status %s', async (status, message) => {
    const fetcher = vi.fn<Fetcher>().mockResolvedValue(jsonResponse({ message }, status));
    const file = new File(['test'], 'proof.png', { type: 'image/png' });

    await expect(uploadAttachment('https://api.example.com', 'jwt', file, fetcher)).rejects.toThrow(
      message,
    );
  });

  it('uses the backend PATCH /notifications/read-all contract', async () => {
    const fetcher = vi.fn<Fetcher>().mockResolvedValue(jsonResponse({ success: true }));
    await markAllNotificationsRead('https://api.example.com', 'jwt', fetcher);

    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example.com/notifications/read-all',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('builds an authenticated download URL and preserves a 404-safe backend route', () => {
    const url = authenticatedFileUrl(
      'https://api.example.com',
      '/attachments/file/missing-drive-file',
      'jwt token',
    );
    expect(url).toBe(
      'https://api.example.com/attachments/file/missing-drive-file?token=jwt+token',
    );
  });
});
