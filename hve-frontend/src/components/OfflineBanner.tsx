import React, { useState, useEffect } from 'react';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [wasOffline, setWasOffline] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setTimeout(() => setWasOffline(false), 4000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  if (isOnline && !wasOffline) {
    return null;
  }

  if (isOnline && wasOffline) {
    return (
      <div className="bg-emerald-600 text-white text-xs font-semibold py-1.5 px-4 text-center flex items-center justify-center space-x-2 transition-all shadow-sm z-50">
        <span>✅</span>
        <span>Đã khôi phục kết nối Internet. Dữ liệu hệ thống đang được đồng bộ thời gian thực.</span>
      </div>
    );
  }

  return (
    <div className="bg-amber-500 text-white text-xs font-semibold py-2 px-4 text-center flex items-center justify-center space-x-2 transition-all shadow-sm z-50 animate-pulse">
      <span>⚡</span>
      <span>
        <strong>Chế độ ngoại tuyến:</strong> Bạn đang xem dữ liệu từ bộ nhớ đệm. Vui lòng kết nối mạng để thực hiện phê duyệt và đồng bộ mới nhất.
      </span>
    </div>
  );
};
