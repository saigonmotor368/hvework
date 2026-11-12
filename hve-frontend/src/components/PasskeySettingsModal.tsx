import React, { useCallback, useEffect, useState } from "react";
import {
  isPasskeyCancelled,
  isPasskeySupported,
  listPasskeys,
  registerPasskey,
  removePasskey,
} from "../api/passkey";
import type { PasskeyDevice } from "../api/passkey";

interface PasskeySettingsModalProps {
  apiBaseUrl: string;
  onClose: () => void;
  showToast: (message: string, type?: "success" | "error") => void;
}

const fmt = (value: string) => new Date(value).toLocaleString("vi-VN");

/** Tên gọi dễ nhận biết cho thiết bị đang dùng, rút từ user-agent. */
function currentDeviceLabel() {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua)
    ? "iPhone/iPad"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac/.test(ua)
          ? "Mac"
          : "Thiết bị";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Safari\//.test(ua)
        ? "Safari"
        : "Trình duyệt";
  return `${os} · ${browser}`;
}

export const PasskeySettingsModal: React.FC<PasskeySettingsModalProps> = ({
  apiBaseUrl,
  onClose,
  showToast,
}) => {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [devices, setDevices] = useState<PasskeyDevice[] | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setDevices(await listPasskeys(apiBaseUrl));
    } catch (error: any) {
      setDevices([]);
      showToast(error.message || "Không tải được danh sách thiết bị", "error");
    }
  }, [apiBaseUrl, showToast]);

  useEffect(() => {
    void isPasskeySupported().then(setSupported);
    void load();
  }, [load]);

  const enable = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    try {
      await registerPasskey(apiBaseUrl, password, currentDeviceLabel());
      setPassword("");
      showToast("Đã bật đăng nhập bằng vân tay / khuôn mặt trên thiết bị này.");
      await load();
    } catch (error: any) {
      if (!isPasskeyCancelled(error)) {
        showToast(error.message || "Không bật được. Vui lòng thử lại.", "error");
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (device: PasskeyDevice) => {
    if (!window.confirm(`Tắt đăng nhập sinh trắc học trên “${device.deviceLabel || "thiết bị"}”?`)) return;
    try {
      await removePasskey(apiBaseUrl, device.id);
      showToast("Đã tắt trên thiết bị đó.");
      await load();
    } catch (error: any) {
      showToast(error.message || "Không xóa được thiết bị", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
      <section className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-900">🔐 Đăng nhập bằng vân tay / khuôn mặt</h2>
            <p className="mt-1 text-xs text-slate-500">
              Dữ liệu vân tay, khuôn mặt chỉ nằm trên thiết bị của anh/chị, HVE Work không lưu và không nhìn thấy.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100" aria-label="Đóng">
            ✕
          </button>
        </div>

        <div className="mt-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Thiết bị đã bật</h3>
          {devices === null ? (
            <p className="mt-2 text-xs text-slate-500">Đang tải...</p>
          ) : devices.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500">
              Chưa có thiết bị nào.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 text-xs">
              {devices.map((device) => (
                <li key={device.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-800">{device.deviceLabel || "Thiết bị"}</p>
                    <p className="text-[11px] text-slate-500">
                      Bật {fmt(device.createdAt)} · dùng gần nhất {fmt(device.lastUsedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void remove(device)}
                    className="shrink-0 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100"
                  >
                    Tắt
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-5 border-t border-slate-100 pt-4">
          {supported === false ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-semibold text-amber-800">
              Thiết bị hoặc trình duyệt này chưa hỗ trợ (hoặc chưa cài khóa màn hình / vân tay / khuôn mặt). Hãy mở
              HVE Work bằng Chrome, Safari hoặc app đã cài, không dùng trình duyệt trong Zalo/Facebook.
            </p>
          ) : (
            <form onSubmit={enable} className="space-y-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Bật cho thiết bị này</h3>
              <label className="block">
                <span className="text-xs font-semibold text-slate-700">Nhập lại mật khẩu để xác nhận</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0A66C2]"
                />
              </label>
              <button
                type="submit"
                disabled={busy || !password || supported === null}
                className="w-full rounded-lg bg-[#0A66C2] px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? "Đang chờ thiết bị xác nhận..." : "Bật vân tay / khuôn mặt"}
              </button>
              <p className="text-[11px] text-slate-500">
                Thiết bị sẽ hỏi vân tay, khuôn mặt hoặc mã mở khóa máy (tùy cài đặt bảo mật của máy).
              </p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
};
