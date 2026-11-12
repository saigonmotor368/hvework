import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { fetchWithSession } from "./client";

export interface PasskeyDevice {
  id: string;
  deviceLabel: string | null;
  createdAt: string;
  lastUsedAt: string;
}

/** Thiết bị có vân tay / khuôn mặt / khóa màn hình dùng được cho passkey. */
export async function isPasskeySupported(): Promise<boolean> {
  try {
    return browserSupportsWebAuthn() && (await platformAuthenticatorIsAvailable());
  } catch {
    return false;
  }
}

/** Người dùng bấm Hủy trên hộp thoại của thiết bị: không phải lỗi. */
export function isPasskeyCancelled(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name;
  return name === "NotAllowedError" || name === "AbortError";
}

/** fetchWithSession chỉ làm mới token đã có sẵn, nên phải gửi kèm Authorization. */
function authHeaders(json = false): Record<string, string> {
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
  };
}

async function readJson(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      (Array.isArray(body.message) ? body.message.join("; ") : body.message) ||
        "Không thực hiện được. Vui lòng thử lại.",
    );
  }
  return body;
}

/** Đăng nhập bằng passkey; trả về đúng dữ liệu như /auth/login. */
export async function loginWithPasskey(apiBaseUrl: string) {
  const { challengeId, options } = await readJson(
    await fetch(`${apiBaseUrl}/auth/passkey/login/options`, { method: "POST" }),
  );
  const assertion = await startAuthentication({ optionsJSON: options });
  return readJson(
    await fetch(`${apiBaseUrl}/auth/passkey/login/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId, response: assertion }),
    }),
  );
}

export async function registerPasskey(
  apiBaseUrl: string,
  password: string,
  deviceLabel: string,
) {
  const { challengeId, options } = await readJson(
    await fetchWithSession(`${apiBaseUrl}/auth/passkey/register/options`, {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ password }),
    }),
  );
  const attestation = await startRegistration({ optionsJSON: options });
  return readJson(
    await fetchWithSession(`${apiBaseUrl}/auth/passkey/register/verify`, {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ challengeId, response: attestation, deviceLabel }),
    }),
  );
}

export async function listPasskeys(apiBaseUrl: string): Promise<PasskeyDevice[]> {
  return readJson(await fetchWithSession(`${apiBaseUrl}/auth/passkeys`, { headers: authHeaders() }));
}

export async function removePasskey(apiBaseUrl: string, id: string) {
  return readJson(
    await fetchWithSession(`${apiBaseUrl}/auth/passkeys/${id}`, { method: "DELETE", headers: authHeaders() }),
  );
}
