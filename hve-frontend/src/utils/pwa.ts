// ==============================================================================
// HVE Work - Client-side PWA and Web Push Registration Utility
// ==============================================================================

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker đăng ký thành công, scope:', reg.scope);
        return reg;
      })
      .catch((err) => {
        console.warn('[PWA] Đăng ký Service Worker thất bại:', err);
        return null;
      });
  }
  return Promise.resolve(null);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToWebPush(apiBaseUrl: string): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.info('[WebPush] Trình duyệt không hỗ trợ Push API');
    return false;
  }

  const token = localStorage.getItem('access_token');
  if (!token) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[WebPush] Người dùng chưa cấp quyền thông báo');
      return false;
    }

    const reg = await navigator.serviceWorker.ready;
    if (!reg) return false;

    // Lấy VAPID Public Key từ Backend
    const keyRes = await fetch(`${apiBaseUrl}/notifications/vapid-public-key`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!keyRes.ok) return false;
    const { publicKey } = await keyRes.json();

    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    let subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as any,
      });
    }

    // Gửi subscription lên Backend
    const subRes = await fetch(`${apiBaseUrl}/notifications/push-subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(subscription),
    });

    return subRes.ok;
  } catch (err) {
    console.warn('[WebPush] Lỗi khi đăng ký Web Push:', err);
    return false;
  }
}
