export type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const DEVICE_ID_KEY = 'hve_device_id';
const SESSION_EXPIRED_MESSAGE_KEY = 'hve_session_expired_message';
export const SESSION_EXPIRED_EVENT = 'hve:session-expired';

const SESSION_EXPIRED_MESSAGE = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
let refreshSessionPromise: Promise<boolean> | null = null;

export function consumeSessionExpiredMessage(): string {
  const message = sessionStorage.getItem(SESSION_EXPIRED_MESSAGE_KEY) || '';
  sessionStorage.removeItem(SESSION_EXPIRED_MESSAGE_KEY);
  return message;
}

export async function fetchWithSession(
  input: RequestInfo | URL,
  init?: RequestInit,
  fetcher: Fetcher = fetch,
): Promise<Response> {
  const response = await fetcher(input, withCurrentAccessToken(init));
  if (response.status !== 401) return response;

  const refreshToken = localStorage.getItem('refresh_token');
  if (refreshToken) {
    if (!refreshSessionPromise) {
      const requestUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const apiOrigin = new URL(requestUrl, window.location.origin).origin;
      refreshSessionPromise = refreshSession(apiOrigin, refreshToken, fetcher).finally(() => {
        refreshSessionPromise = null;
      });
    }

    if (await refreshSessionPromise) {
      const retriedResponse = await fetcher(input, withCurrentAccessToken(init));
      if (retriedResponse.status !== 401) return retriedResponse;
    }
  }

  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  sessionStorage.setItem(SESSION_EXPIRED_MESSAGE_KEY, SESSION_EXPIRED_MESSAGE);
  window.dispatchEvent(
    new CustomEvent(SESSION_EXPIRED_EVENT, { detail: SESSION_EXPIRED_MESSAGE }),
  );
  window.location.assign('/');

  throw new Error(SESSION_EXPIRED_MESSAGE);
}

function withCurrentAccessToken(init?: RequestInit): RequestInit | undefined {
  if (!init?.headers) return init;

  const headers = new Headers(init.headers);
  const accessToken = localStorage.getItem('access_token');
  if (headers.has('Authorization') && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return { ...init, headers };
}

async function refreshSession(
  apiOrigin: string,
  refreshToken: string,
  fetcher: Fetcher,
): Promise<boolean> {
  try {
    const response = await fetcher(`${apiOrigin}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return false;

    const tokens = await response.json();
    if (typeof tokens.access_token !== 'string' || typeof tokens.refresh_token !== 'string') {
      return false;
    }

    localStorage.setItem('access_token', tokens.access_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);
    return true;
  } catch {
    return false;
  }
}

export function getOrCreateDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export function currentDeviceName(): string {
  return navigator.userAgent.slice(0, 200);
}

function apiUrl(apiBaseUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${apiBaseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

async function responseMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => ({}));
  return typeof body?.message === 'string' ? body.message : fallback;
}

export async function uploadAttachment(
  apiBaseUrl: string,
  token: string,
  file: File,
  fetcher: Fetcher = fetch,
): Promise<number> {
  const mimeType = file.type || 'application/pdf';
  const presignResponse = await fetcher(apiUrl(apiBaseUrl, '/attachments/presigned-url'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fileName: file.name, mimeType, size: file.size }),
  });

  if (!presignResponse.ok) {
    throw new Error(await responseMessage(presignResponse, 'Không lấy được URL tải lên tệp'));
  }

  const presigned = await presignResponse.json();
  if (!presigned.uploadUrl) throw new Error('Máy chủ không trả về URL tải lên hợp lệ');

  const uploadResponse = await fetcher(apiUrl(apiBaseUrl, presigned.uploadUrl), {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error(await responseMessage(uploadResponse, 'Tải tệp lên Google Drive thất bại'));
  }

  const uploaded = await uploadResponse.json();
  if (!uploaded.fileUrl) throw new Error('Máy chủ không trả về đường dẫn tệp đã tải lên');

  const registerResponse = await fetcher(apiUrl(apiBaseUrl, '/attachments/register'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      fileName: file.name,
      mimeType,
      size: uploaded.size ?? file.size,
      fileUrl: uploaded.fileUrl,
    }),
  });

  if (!registerResponse.ok) {
    throw new Error(await responseMessage(registerResponse, 'Không đăng ký được thông tin tệp'));
  }

  const registered = await registerResponse.json();
  if (typeof registered.id !== 'number') throw new Error('Máy chủ không trả về mã tệp hợp lệ');
  return registered.id;
}

export async function markAllNotificationsRead(
  apiBaseUrl: string,
  token: string,
  fetcher: Fetcher = fetch,
): Promise<void> {
  const response = await fetcher(apiUrl(apiBaseUrl, '/notifications/read-all'), {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(await responseMessage(response, 'Không đánh dấu được toàn bộ thông báo'));
  }
}

export function authenticatedFileUrl(apiBaseUrl: string, fileUrl: string, token: string): string {
  const url = new URL(apiUrl(apiBaseUrl, fileUrl));
  url.searchParams.set('token', token);
  return url.toString();
}
