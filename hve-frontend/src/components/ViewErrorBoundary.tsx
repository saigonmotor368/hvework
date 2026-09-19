import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ViewErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("HVE view rendering failed", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-bold text-red-800">Không tải được màn hình này.</p>
          <p className="mt-1 text-sm text-red-600">
            Dữ liệu phiên hiện tại có thể đã cũ sau khi hệ thống cập nhật.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
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
