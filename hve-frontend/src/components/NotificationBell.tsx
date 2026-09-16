import React, { useState, useEffect, useRef } from 'react';

interface NotificationItem {
  id: number;
  eventType: string;
  entityRef: string;
  title?: string;
  content?: string;
  link?: string;
  readAt: string | null;
  sentAt: string;
}

interface NotificationBellProps {
  apiBaseUrl: string;
  onNavigate: (link?: string) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ apiBaseUrl, onNavigate }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    try {
      const res = await fetch(`${apiBaseUrl}/notifications?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll notifications every 30s
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id: number, link?: string) => {
    const token = localStorage.getItem('access_token');
    try {
      await fetch(`${apiBaseUrl}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore
    }

    if (link) {
      setIsOpen(false);
      onNavigate(link);
    }
  };

  const markAllAsRead = async () => {
    setIsLoading(true);
    const token = localStorage.getItem('access_token');
    try {
      await fetch(`${apiBaseUrl}/notifications/mark-all-read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })),
      );
      setUnreadCount(0);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return 'Vừa xong';
      if (diffMins < 60) return `${diffMins} phút trước`;
      if (diffHours < 24) return `${diffHours} giờ trước`;
      return date.toLocaleDateString('vi-VN');
    } catch {
      return '';
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'document_pending_approval':
        return '⏳';
      case 'document_approved':
        return '✅';
      case 'document_returned':
        return '↩️';
      case 'document_rejected':
        return '❌';
      case 'task_escalated_ceo':
      case 'task_escalated_dept':
        return '🚨';
      case 'task_overdue':
        return '⚠️';
      case 'task_due_soon':
        return '⏰';
      case 'contract_expiring_soon':
        return '📜';
      default:
        return '🔔';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-slate-100 transition-colors focus:outline-none"
        title="Thông báo"
      >
        <span className="text-xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full border-2 border-white animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm text-gray-800">Thông báo</span>
              {unreadCount > 0 && (
                <span className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">
                  {unreadCount} mới
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                disabled={isLoading}
                className="text-xs text-[#0A66C2] hover:underline font-medium disabled:opacity-50"
              >
                Đọc tất cả
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                <span className="text-2xl block mb-1">🎉</span>
                Không có thông báo nào mới
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => markAsRead(n.id, n.link)}
                  className={`p-3.5 hover:bg-slate-50 cursor-pointer transition-colors flex items-start space-x-3 ${
                    !n.readAt ? 'bg-blue-50/40' : ''
                  }`}
                >
                  <span className="text-xl mt-0.5">{getEventIcon(n.eventType)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className={`text-xs truncate ${!n.readAt ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {n.title || 'Thông báo hệ thống'}
                      </p>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                        {formatTime(n.sentAt)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">{n.content}</p>
                  </div>
                  {!n.readAt && (
                    <span className="w-2 h-2 rounded-full bg-[#0A66C2] mt-1.5 flex-shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 text-center border-t border-slate-100 bg-slate-50/50">
            <span className="text-[11px] text-gray-400">Tự động cập nhật tức thời theo luồng duyệt</span>
          </div>
        </div>
      )}
    </div>
  );
};
