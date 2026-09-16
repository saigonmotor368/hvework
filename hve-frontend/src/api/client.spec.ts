import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  authenticatedFileUrl,
  consumeSessionExpiredMessage,
  fetchWithSession,
  markAllNotificationsRead,
  SESSION_EXPIRED_EVENT,
  uploadAttachment,
  type Fetcher,
} from './client';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const memoryStorage = (): Storage => {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
};

afterEach(() => vi.unstubAllGlobals());

describe('API contracts', () => {
  it('refreshes an expired access token and retries the original request once', async () => {
    const dispatchEvent = vi.fn();
    const assign = vi.fn();
    vi.stubGlobal('localStorage', memoryStorage());
    vi.stubGlobal('sessionStorage', memoryStorage());
    vi.stubGlobal('window', {
      dispatchEvent,
      location: { assign, origin: 'https://work.example.com' },
    });
    localStorage.setItem('access_token', 'expired-jwt');
    localStorage.setItem('refresh_token', 'valid-refresh');
    const fetcher = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(
        jsonResponse({ access_token: 'new-jwt', refresh_token: 'new-refresh' }),
      )
      .mockResolvedValueOnce(jsonResponse({ id: 7 }, 201));

    const response = await fetchWithSession(
      'https://api.example.com/admin/users',
      { method: 'POST', headers: { Authorization: 'Bearer expired-jwt' } },
      fetcher,
    );

    expect(response.status).toBe(201);
    expect(fetcher.mock.calls[1][0]).toBe('https://api.example.com/auth/refresh');
    expect((fetcher.mock.calls[2][1]?.headers as Headers).get('Authorization')).toBe(
      'Bearer new-jwt',
    );
    expect(localStorage.getItem('refresh_token')).toBe('new-refresh');
    expect(dispatchEvent).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it('clears an expired login session and exposes a friendly message on 401', async () => {
    const dispatchEvent = vi.fn();
    const assign = vi.fn();
    vi.stubGlobal('localStorage', memoryStorage());
    vi.stubGlobal('sessionStorage', memoryStorage());
    vi.stubGlobal('window', {
      dispatchEvent,
      location: { assign, origin: 'https://work.example.com' },
    });
    vi.stubGlobal(
      'CustomEvent',
      class {
        type: string;
        detail: unknown;
        constructor(type: string, init: { detail: unknown }) {
          this.type = type;
          this.detail = init.detail;
        }
      },
    );
    localStorage.setItem('access_token', 'expired-jwt');
    localStorage.setItem('refresh_token', 'expired-refresh');
    localStorage.setItem('user', JSON.stringify({ id: 1 }));
    const fetcher = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({}, 401));

    await expect(fetchWithSession('/admin/users', {}, fetcher)).rejects.toThrow(
      'Phiên đăng nhập đã hết hạn',
    );

    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(dispatchEvent).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledWith('/');
    expect(dispatchEvent.mock.calls[0][0]).toMatchObject({
      type: SESSION_EXPIRED_EVENT,
      detail: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    });
    expect(consumeSessionExpiredMessage()).toBe(
      'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    );
  });

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
