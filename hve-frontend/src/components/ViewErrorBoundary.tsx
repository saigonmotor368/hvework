import React from 'react';
import {
  clearHveAppCaches,
  isLazyChunkLoadError,
  reloadLatestAppVersion,
  VIEW_ERROR_RECOVERY_KEY,
} from '../utils/lazyModuleRecovery';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  isRecovering: boolean;
}

export class ViewErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, isRecovering: false };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("HVE view rendering failed", error, info.componentStack);
    // A deployment can replace a lazy chunk while a tab is still open. Retry
    // once automatically so users do not get stuck on a stale bundle. The
    // session flag prevents an infinite reload loop when the error is real.
    if (
      isLazyChunkLoadError(error) &&
      !window.sessionStorage.getItem(VIEW_ERROR_RECOVERY_KEY)
    ) {
      window.sessionStorage.setItem(VIEW_ERROR_RECOVERY_KEY, '1');
      this.setState({ isRecovering: true });
      void clearHveAppCaches().finally(() => {
        const url = new URL(window.location.href);
        url.searchParams.set('_hve_update', Date.now().toString());
        window.location.replace(url);
      });
      return;
    }
  }

  private handleReload = () => {
    this.setState({ isRecovering: true });
    void reloadLatestAppVersion();
  };

  render() {
    if (this.state.hasError) {
      if (this.state.isRecovering) {
        return (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 text-center">
            <p className="font-bold text-blue-800">Đang cập nhật màn hình…</p>
            <p className="mt-1 text-sm text-blue-600">
              HVE Work đang tải phiên bản mới nhất, vui lòng chờ một chút.
            </p>
          </div>
        );
      }
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-bold text-red-800">Không tải được màn hình này.</p>
          <p className="mt-1 text-sm text-red-600">
            Dữ liệu phiên hiện tại có thể đã cũ sau khi hệ thống cập nhật.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-4 rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-800"
          >
            Tải lại màn hình
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
