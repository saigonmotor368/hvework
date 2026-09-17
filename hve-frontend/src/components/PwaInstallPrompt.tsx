import React, { useState, useEffect } from 'react';

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [showIosGuide, setShowIosGuide] = useState<boolean>(false);

  // Check if device is iOS
  const isIos = () => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent);
  };

  // Check if running in standalone mode (already installed)
  const isStandalone = () => {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  };

  useEffect(() => {
    if (isStandalone()) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos()) {
      setShowIosGuide(true);
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      setShowIosGuide(true);
    }
  };

  if (isInstalled) {
    return null;
  }

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="w-full mt-2 flex items-center justify-center space-x-2 px-3 py-2 text-xs font-bold text-[#0A66C2] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all shadow-sm active:scale-95"
        title="Cài đặt Hệ Thống Quản Lý Công Việc lên màn hình chính điện thoại hoặc máy tính"
      >
        <span>📲</span>
        <span>Cài đặt ứng dụng HVE</span>
      </button>

      {/* Modal Hướng dẫn cài đặt iOS Safari */}
      {showIosGuide && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <img src="/icons/icon-192.png" alt="HVE" className="w-7 h-7 rounded-lg" />
                <h3 className="font-black text-gray-900 text-sm">Cài đặt Hệ Thống Quản Lý Công Việc</h3>
              </div>
              <button
                onClick={() => setShowIosGuide(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Để cài đặt Hệ Thống Quản Lý Công Việc chạy độc lập toàn màn hình như ứng dụng native:
            </p>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-2.5 text-gray-700">
              <div className="flex items-start space-x-2">
                <span className="font-bold text-[#0A66C2] bg-blue-100 px-1.5 py-0.5 rounded">1</span>
                <span>
                  Bấm vào biểu tượng <strong>Chia sẻ</strong> (ô vuông mũi tên hướng lên ⎋) ở thanh công cụ trình duyệt Safari / Chrome.
                </span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="font-bold text-[#0A66C2] bg-blue-100 px-1.5 py-0.5 rounded">2</span>
                <span>
                  Cuộn xuống và chọn <strong>"Thêm vào Màn hình chính"</strong> (Add to Home Screen).
                </span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="font-bold text-[#0A66C2] bg-blue-100 px-1.5 py-0.5 rounded">3</span>
                <span>
                  Bấm <strong>"Thêm"</strong> (Add) ở góc trên bên phải để hoàn tất.
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2.5 bg-[#0A66C2] hover:bg-[#084e96] text-white text-xs font-bold rounded-xl transition-all shadow-sm"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </>
  );
};
