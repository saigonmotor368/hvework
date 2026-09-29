export interface LazyModuleRecoveryRuntime {
  getRetryFlag: (key: string) => string | null;
  setRetryFlag: (key: string, value: string) => void;
  clearRetryFlag: (key: string) => void;
  prepareReloadUrl: (tab: string) => void;
  clearAppCaches: () => Promise<void>;
  reload: () => void;
}

export const VIEW_ERROR_RECOVERY_KEY = "hve:view-error-recovery";

export const clearHveAppCaches = async () => {
  if (!("caches" in window)) return;
  const cacheNames = await window.caches.keys();
  await Promise.all(
    cacheNames
      .filter((cacheName) => cacheName.startsWith("hve-work-cache-"))
      .map((cacheName) => window.caches.delete(cacheName)),
  );
};

const browserRuntime: LazyModuleRecoveryRuntime = {
  getRetryFlag: (key) => window.sessionStorage.getItem(key),
  setRetryFlag: (key, value) => window.sessionStorage.setItem(key, value),
  clearRetryFlag: (key) => window.sessionStorage.removeItem(key),
  prepareReloadUrl: (tab) => {
    const url = new URL(window.location.href);
    url.pathname = "/";
    url.searchParams.set("tab", tab);
    url.searchParams.set("_hve_update", Date.now().toString());
    window.history.replaceState({}, "", url);
  },
  clearAppCaches: clearHveAppCaches,
  reload: () => window.location.reload(),
};

export async function reloadLatestAppVersion(tab?: string) {
  Object.keys(window.sessionStorage)
    .filter(
      (key) =>
        key.startsWith("hve:lazy-reload:") || key === VIEW_ERROR_RECOVERY_KEY,
    )
    .forEach((key) => window.sessionStorage.removeItem(key));
  await clearHveAppCaches();

  const url = new URL(window.location.href);
  url.pathname = "/";
  if (tab) url.searchParams.set("tab", tab);
  url.searchParams.set("_hve_update", Date.now().toString());
  window.location.replace(url);
}

export const isLazyChunkLoadError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return /chunkloaderror|loading chunk|dynamically imported module|importing a module script failed/i.test(
    message,
  );
};

/**
 * Sau một lần phát hành, tab đang mở có thể vẫn giữ bundle cũ và trỏ tới tên
 * chunk đã được thay thế. Tự tải lại đúng một lần, đồng thời giữ nguyên màn
 * người dùng vừa chọn. Lỗi code thật vẫn được chuyển cho ErrorBoundary.
 */
export async function loadLazyModuleWithRecovery<T>(
  loader: () => Promise<T>,
  tab: string,
  runtime: LazyModuleRecoveryRuntime = browserRuntime,
): Promise<T> {
  const retryKey = `hve:lazy-reload:${tab}`;

  try {
    const module = await loader();
    runtime.clearRetryFlag(retryKey);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(VIEW_ERROR_RECOVERY_KEY);
    }
    return module;
  } catch (error) {
    if (!isLazyChunkLoadError(error)) throw error;

    if (!runtime.getRetryFlag(retryKey)) {
      runtime.setRetryFlag(retryKey, "1");
      await runtime.clearAppCaches();
      runtime.prepareReloadUrl(tab);
      runtime.reload();
      return new Promise<T>(() => undefined);
    }

    runtime.clearRetryFlag(retryKey);
    throw error;
  }
}
