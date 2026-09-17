// ==============================================================================
// HVE Work - Client-side PWA and Web Push Registration Utility
// ==============================================================================

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (
    "serviceWorker" in navigator &&
    (window.location.protocol === "https:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
  ) {
    return navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => {
        console.log(
          "[PWA] Service Worker đăng ký thành công, scope:",
          reg.scope,
        );
        void reg.update();
        return reg;
      })
      .catch((err) => {
        console.warn("[PWA] Đăng ký Service Worker thất bại:", err);
        return null;
      });
  }
  return Promise.resolve(null);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type WebPushStatus =
  "unsupported" | "permission-required" | "denied" | "ready" | "subscribed";

const PUSH_SYNC_KEY = "hve_push_subscription_sync";
const PUSH_SYNC_TTL_MS = 6 * 60 * 60 * 1000;

export async function getWebPushStatus(): Promise<WebPushStatus> {
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "permission-required";

  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.getSubscription();
  return subscription ? "subscribed" : "ready";
}

export async function subscribeToWebPush(
  apiBaseUrl: string,
  options: { requestPermission?: boolean } = {},
): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.info("[WebPush] Trình duyệt không hỗ trợ Push API");
    return false;
  }

  const token = localStorage.getItem("access_token");
  if (!token) return false;

  try {
    const permission =
      Notification.permission === "default" &&
      options.requestPermission !== false
        ? await Notification.requestPermission()
        : Notification.permission;
    if (permission !== "granted") {
      console.log("[WebPush] Người dùng chưa cấp quyền thông báo");
      return false;
    }

    const reg = await navigator.serviceWorker.ready;
    if (!reg) return false;

    let subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      // Public key không phải dữ liệu bí mật và endpoint này không cần JWT/DB.
      const keyRes = await fetch(
        `${apiBaseUrl}/notifications/vapid-public-key`,
      );
      if (!keyRes.ok) return false;
      const { publicKey } = await keyRes.json();
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as any,
      });
    }

    const previousSync = JSON.parse(
      localStorage.getItem(PUSH_SYNC_KEY) || "null",
    );
    if (
      previousSync?.endpoint === subscription.endpoint &&
      Date.now() - Number(previousSync.syncedAt || 0) < PUSH_SYNC_TTL_MS
    ) {
      return true;
    }

    // Gửi subscription lên Backend
    const subRes = await fetch(`${apiBaseUrl}/notifications/push-subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(subscription),
    });

    if (subRes.ok) {
      localStorage.setItem(
        PUSH_SYNC_KEY,
        JSON.stringify({
          endpoint: subscription.endpoint,
          syncedAt: Date.now(),
        }),
      );
    }
    return subRes.ok;
  } catch (err) {
    console.warn("[WebPush] Lỗi khi đăng ký Web Push:", err);
    return false;
  }
}
