import React from 'react';

interface ToastProps {
  toast: { message: string; type: 'success' | 'error' } | null;
}

export const Toast: React.FC<ToastProps> = ({ toast }) => {
  if (!toast) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center px-4 py-3 rounded-xl shadow-lg border transition-all ${
        toast.type === 'success'
          ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
          : 'bg-red-50 text-red-900 border-red-200'
      }`}
    >
      <span className="font-medium text-sm">{toast.message}</span>
    </div>
  );
};
