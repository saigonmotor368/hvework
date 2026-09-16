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

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-bold text-red-800">Không tải được màn hình này.</p>
          <p className="mt-1 text-sm text-red-600">Vui lòng chuyển sang mục khác rồi thử lại.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
