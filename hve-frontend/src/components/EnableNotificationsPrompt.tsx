import React, { useEffect, useState } from 'react';
import { getWebPushStatus, subscribeToWebPush } from '../utils/pwa';

interface Props {
  apiBaseUrl: string;
}

const DISMISS_KEY = 'hve_notif_prompt_dismissed';

export const EnableNotificationsPrompt: React.FC<Props> = ({ apiBaseUrl }) => {
  const [visible, setVisible] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);

  const isIosDevice =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;
  // iOS chỉ hỗ trợ Web Push khi app đã được cài lên màn hình chính và mở
  // từ đó (standalone) — mở qua Safari thường thì không nhận được gì cả.
  const iosNeedsInstallFirst = isIosDevice && !isStandalone;

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    getWebPushStatus().then((status) => {
      if (status === 'permission-required') {
        setVisible(true);
      }
    });
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  const handleEnable = async () => {
    setIsEnabling(true);
    try {
      await subscribeToWebPush(apiBaseUrl, { requestPermission: true });
    } finally {
      setIsEnabling(false);
      dismiss();
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-3 text-3xl">🔔</div>
        <h3 className="mb-1.5 text-base font-extrabold text-gray-900">
          Bật thông báo để không bỏ lỡ công việc
        </h3>

        {iosNeedsInstallFirst ? (
          <>
            <p className="mb-4 text-sm leading-relaxed text-gray-600">
              Trên iPhone/iPad, bạn cần <strong>cài đặt HVE Work vào màn hình chính</strong> trước
              thì mới bật được thông báo — mở qua Safari thông thường sẽ không nhận được.
            </p>
            <a
              href="/install.html"
              className="mb-2 block w-full rounded-xl bg-[#0A66C2] px-4 py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-blue-700"
            >
              📲 Xem hướng dẫn cài đặt
            </a>
            <button
              onClick={dismiss}
              className="w-full rounded-xl px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-slate-50"
            >
              Để sau
            </button>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm leading-relaxed text-gray-600">
              Bạn sẽ nhận được thông báo ngay khi có hồ sơ cần duyệt hoặc công việc mới được giao —
              ngay cả khi không mở app.
            </p>
            <button
              onClick={handleEnable}
              disabled={isEnabling}
              className="mb-2 w-full rounded-xl bg-[#0A66C2] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {isEnabling ? 'Đang bật...' : '🔔 Bật thông báo ngay'}
            </button>
            <button
              onClick={dismiss}
              disabled={isEnabling}
              className="w-full rounded-xl px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-slate-50 disabled:opacity-50"
            >
              Để sau
            </button>
          </>
        )}
      </div>
    </div>
  );
};
