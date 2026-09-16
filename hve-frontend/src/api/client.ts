export type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

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
