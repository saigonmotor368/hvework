import React, { useCallback, useState, useEffect, useRef } from "react";
import { fetchWithSession, markAllNotificationsRead } from "../api/client";
import {
  getWebPushStatus,
  subscribeToWebPush,
  type WebPushStatus,
} from "../utils/pwa";

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

export const NotificationBell: React.FC<NotificationBellProps> = ({
  apiBaseUrl,
  onNavigate,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<WebPushStatus>(
    "permission-required",
  );
  const [isEnablingPush, setIsEnablingPush] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hasFetchedOnceRef = useRef(false);
  const isIosDevice =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  const syncAppBadge = (count: number) => {
    const badgeNavigator = navigator as Navigator & {
      setAppBadge?: (value?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (count > 0) void badgeNavigator.setAppBadge?.(count);
    else void badgeNavigator.clearAppBadge?.();
  };

  const fetchNotifications = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    try {
      const res = await fetchWithSession(
        `${apiBaseUrl}/notifications?limit=20`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Không thể tải thông báo");
      const data = await res.json();
      const items = Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.notifications)
          ? data.notifications
          : [];
      const nextUnreadCount = Number(data.unreadCount) || 0;
      setNotifications(items);
      setUnreadCount(nextUnreadCount);
      syncAppBadge(nextUnreadCount);
      setLoadError(null);
    } catch (error: any) {
      setLoadError(error.message || "Không thể tải thông báo");
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!hasFetchedOnceRef.current) {
      hasFetchedOnceRef.current = true;
      void fetchNotifications();
    }
    void getWebPushStatus().then(setPushStatus);
    // Web Push là kênh tức thời. Polling chỉ là fallback để tránh gọi DB liên
    // tục: 5 phút khi đã subscribe, 1 phút khi trình duyệt chưa có push.
    const pollingInterval =
      pushStatus === "subscribed" ? 5 * 60 * 1000 : 60 * 1000;
    const interval = setInterval(fetchNotifications, pollingInterval);
    return () => clearInterval(interval);
  }, [fetchNotifications, pushStatus]);

  useEffect(() => {
    const handlePushMessage = (event: MessageEvent) => {
      if (event.data?.type === "HVE_PUSH_RECEIVED") void fetchNotifications();
    };
    navigator.serviceWorker?.addEventListener("message", handlePushMessage);
    return () =>
      navigator.serviceWorker?.removeEventListener(
        "message",
        handlePushMessage,
      );
  }, [fetchNotifications]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (id: number, link?: string) => {
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetchWithSession(
        `${apiBaseUrl}/notifications/${id}/read`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Không thể đánh dấu đã đọc");
      const wasUnread = notifications.some((n) => n.id === id && !n.readAt);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, readAt: new Date().toISOString() } : n,
        ),
      );
      if (wasUnread) {
        setUnreadCount((prev) => {
          const next = Math.max(0, prev - 1);
          syncAppBadge(next);
          return next;
        });
      }
    } catch (error: any) {
      setLoadError(error.message || "Không thể cập nhật thông báo");
    }

    if (link) {
      setIsOpen(false);
      onNavigate(link);
    }
  };

  const markAllAsRead = async () => {
    setIsLoading(true);
    const token = localStorage.getItem("access_token");
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      await markAllNotificationsRead(apiBaseUrl, token);
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          readAt: n.readAt || new Date().toISOString(),
        })),
      );
      setUnreadCount(0);
      syncAppBadge(0);
    } catch (error) {
      console.warn(
        "[Notifications] Không thể đánh dấu tất cả là đã đọc:",
        error,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const enablePush = async () => {
    setIsEnablingPush(true);
    try {
      const enabled = await subscribeToWebPush(apiBaseUrl, {
        requestPermission: true,
      });
      setPushStatus(await getWebPushStatus());
      if (!enabled && Notification.permission === "denied") {
        setLoadError(
          "Quyền thông báo đang bị chặn. Hãy bật lại trong Cài đặt của thiết bị.",
        );
      } else if (!enabled) {
        setLoadError(
          isIosDevice
            ? "Hãy cài HVE Work vào Màn hình chính rồi mở từ biểu tượng app để bật thông báo."
            : "Hãy dùng Chrome/Edge mới nhất và cho phép HVE Work gửi thông báo trong cài đặt trình duyệt.",
        );
      } else {
        setLoadError(null);
      }
    } finally {
      setIsEnablingPush(false);
    }
  };

  const toggleOpen = () => {
    if (!isOpen) void fetchNotifications();
    setIsOpen((open) => !open);
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return "Vừa xong";
      if (diffMins < 60) return `${diffMins} phút trước`;
      if (diffHours < 24) return `${diffHours} giờ trước`;
      return date.toLocaleDateString("vi-VN");
    } catch {
      return "";
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "document_pending_approval":
        return "⏳";
      case "document_approved":
        return "✅";
      case "document_returned":
        return "↩️";
      case "document_rejected":
        return "❌";
      case "task_escalated_ceo":
      case "task_escalated_dept":
        return "🚨";
      case "task_overdue":
        return "⚠️";
      case "task_due_soon":
        return "⏰";
      case "contract_expiring_soon":
        return "📜";
      case "announcement_published":
        return "📢";
      case "proposal_received":
        return "💡";
      default:
        return "🔔";
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleOpen}
        className="relative p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-slate-100 transition-colors focus:outline-none"
        title="Thông báo"
      >
        <span className="text-xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full border-2 border-white animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed left-3 right-3 top-14 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-fadeIn sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:w-[90vw] sm:max-w-96">
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
          <div className="mobile-scroll max-h-[min(60dvh,380px)] overflow-y-auto divide-y divide-slate-100">
            {loadError && notifications.length === 0 ? (
              <div className="px-5 py-7 text-center text-xs text-red-600">
                <span className="mb-2 block text-2xl">⚠️</span>
                {loadError}
                <button
                  type="button"
                  onClick={() => fetchNotifications()}
                  className="mt-3 block w-full font-bold text-[#0A66C2]"
                >
                  Thử tải lại
                </button>
              </div>
            ) : notifications.length === 0 ? (
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
                    !n.readAt ? "bg-blue-50/40" : ""
                  }`}
                >
                  <span className="text-xl mt-0.5">
                    {getEventIcon(n.eventType)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p
                        className={`text-xs truncate ${!n.readAt ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}
                      >
                        {n.title || "Thông báo hệ thống"}
                      </p>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                        {formatTime(n.sentAt)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {n.content}
                    </p>
                  </div>
                  {!n.readAt && (
                    <span className="w-2 h-2 rounded-full bg-[#0A66C2] mt-1.5 flex-shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 bg-slate-50/50 p-2.5 text-center">
            {pushStatus === "subscribed" ? (
              <span className="text-[11px] font-semibold text-emerald-700">
                ● Thông báo nền đã bật trên thiết bị này
              </span>
            ) : pushStatus === "denied" ? (
              <span className="text-[11px] font-semibold text-red-600">
                Thông báo đang bị chặn trong Cài đặt thiết bị
              </span>
            ) : pushStatus === "unsupported" ? (
              <span className="text-[11px] text-gray-500">
                {isIosDevice
                  ? "iPhone/iPad: cài HVE Work vào Màn hình chính rồi mở app để bật thông báo"
                  : "Android: mở bằng Chrome/Edge mới nhất, cài HVE Work và cho phép thông báo"}
              </span>
            ) : (
              <button
                type="button"
                onClick={enablePush}
                disabled={isEnablingPush}
                className="w-full rounded-lg bg-blue-50 px-3 py-2 text-[11px] font-bold text-[#0A66C2] hover:bg-blue-100 disabled:opacity-60"
              >
                {isEnablingPush
                  ? "Đang bật..."
                  : "🔔 Bật thông báo nền (Android/iPhone)"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
